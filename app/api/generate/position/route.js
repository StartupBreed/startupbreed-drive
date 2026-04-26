import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../../../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function readClientIntake(drive, clientFolderId) {
  const res = await drive.files.list({
    q: `'${clientFolderId}' in parents and trashed = false and name contains 'Client Intake'`,
    fields: 'files(id, name)',
    pageSize: 5,
  });
  const file = res.data.files?.[0];
  if (!file) return null;

  const content = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'text' }
  );
  return content.data;
}

function buildPositionPrompt({ positionName, companyName, seniority, salaryRange, additionalNote, intakeContent }) {
  return `You are generating two recruitment documents for a headhunting firm. Use the Client Intake below as your primary source of company information.

CLIENT INTAKE (company context):
${intakeContent || 'No Client Intake available — use the company name to infer context.'}

---

POSITION DETAILS:
Position Name: ${positionName}
Company: ${companyName}
Seniority Level: ${seniority || 'Not specified'}
Salary Range: ${salaryRange || 'To be confirmed'}
Additional Note: ${additionalNote || 'None'}

---

Generate exactly two documents. Return ONLY a valid JSON object with two keys: "preHunt" and "jobDescription". Each value is the complete document as a plain text string. No markdown code blocks outside the JSON.

PRE-HUNT DOCUMENT (key "preHunt"):
Fill every field. Use "[To be confirmed]" only for PoC contact details, exact package details, and interview process specifics that require direct client input.

Position Name: ${positionName}
Company: ${companyName}

POC CONTACT DETAILS
Name: [To be confirmed]
Position: [To be confirmed]
Phone Number: [To be confirmed]
Email: [To be confirmed]

POSITION SUMMARY
Position Name: ${positionName}
Similar Job Titles: [2–3 similar titles]
Level: ${seniority || '[Entry / Associate / Senior / Manager / Director / Executive]'}
Candidate Start Date: [To be confirmed]
Salary Range: ${salaryRange || '[To be confirmed]'}
Package Details: [To be confirmed]
Work Arrangement: [On-site / Hybrid / Remote — infer from company info]
Goals/Expectation: [Key goals for first 3–6 months in this specific role]
New Hire/Replacement: [To be confirmed]

TEAM ENVIRONMENT
Hiring Manager Name: [To be confirmed]
Hiring Manager Position: [To be confirmed]
Works Closely With: [likely teams based on this role]
Team Size: [To be confirmed]
Team Culture: [inferred from company culture in intake]

SKILLS & COMPETENCIES
Responsibilities:
[Write 8–10 bullet points. Each starts with an action verb. Tailor specifically to this role, company stage, and industry. Make each point specific and meaningful — not copy-pasted from a generic JD.]
Qualifications:
[Required and preferred — education, certifications, years of experience specific to this role]
Non-Negotiable:
[4–6 must-have skills/experience for this exact role]
Nice-to-Have:
[3–5 desirable but not essential skills]

CLIENT'S INTERVIEW PROCESS
No. | Interview Process | Type | By Who | What is being assessed
1 | [To be confirmed] | Online | [To be confirmed] | [assessment focus]
2 | [To be confirmed] | Online | [To be confirmed] | [assessment focus]
3 | [To be confirmed] | Online | [To be confirmed] | [assessment focus]

OUTREACH MESSAGES
Request to Connect (max 300 characters):
[Brief, professional LinkedIn message. Mention role, company USP, invite to connect. Max 300 chars.]

After Connection:
[Warm follow-up: recruiter represents StartupBreed as the firm, outlines key responsibilities, invites candidate to schedule a call. Friendly and professional tone.]

PHONE SCREENING QUESTIONS
Format: Question | Expected Answer

General/Introduction Questions
[Question 1] | [Expected Answer]
[Question 2] | [Expected Answer]
[Question 3] | [Expected Answer]

Specific Questions (tailored to this role)
[Question 1] | [Expected Answer]
[Question 2] | [Expected Answer]
[Question 3] | [Expected Answer]
[Question 4] | [Expected Answer]
[Question 5] | [Expected Answer]
[Question 6] | [Expected Answer]

Compensation Questions
[Question 1] | [Expected Answer]
[Question 2] | [Expected Answer]
[Question 3] | [Expected Answer]
[Question 4] | [Expected Answer]

NOTE SCREENING STRUCTURE:
Firstname Lastname (Nickname)
Current compensation:
Expectations:
Notice period:
Notes: [key experience points relevant to this role]

---

JOB DESCRIPTION DOCUMENT (key "jobDescription"):
Create a complete, professional, candidate-facing job description ready to post.

${companyName}: ${positionName}

About the Company
[3–4 sentences: mission, values, culture, notable achievements — written for a candidate reading for the first time]

About the Role
[2–3 sentences on the purpose of this role and how it fits into the company structure]

Responsibilities
[8–10 bullet points, action verbs, specific to this role and company — not generic]

Qualifications
[Required and preferred: education, skills, years of experience, certifications]

Language Proficiency
[Required and preferred languages and level]

Benefits
[List benefits from intake if available, or "Competitive package — details to be confirmed"]

Working Conditions
[Location, remote/on-site/hybrid, working hours]

Learn More About the Company
[Website and LinkedIn from intake]`;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { positionName, companyName, seniority, salaryRange, additionalNote, positionFolderId, clientFolderId } = body;

  if (!positionName || !positionFolderId || !clientFolderId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  // Read existing Client Intake from the client folder
  const intakeContent = await readClientIntake(drive, clientFolderId);

  let parsed;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: 'You are an expert recruitment consultant at a professional headhunting firm in Bangkok. Generate detailed Pre-hunt and Job Description documents. Always return a single valid JSON object with keys "preHunt" and "jobDescription". No markdown code blocks outside the JSON.',
      messages: [{ role: 'user', content: buildPositionPrompt({ ...body, intakeContent }) }],
    });

    const text = message.content[0].text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    return Response.json({ error: 'Generation failed: ' + err.message }, { status: 500 });
  }

  try {
    const [phFile, jdFile] = await Promise.all([
      drive.files.create({
        requestBody: { name: `Pre-hunt_ ${companyName}_${positionName}.txt`, parents: [positionFolderId], mimeType: 'text/plain' },
        media: { mimeType: 'text/plain', body: Readable.from(parsed.preHunt) },
        fields: 'id, name',
      }),
      drive.files.create({
        requestBody: { name: `JD_${companyName}_${positionName}.txt`, parents: [positionFolderId], mimeType: 'text/plain' },
        media: { mimeType: 'text/plain', body: Readable.from(parsed.jobDescription) },
        fields: 'id, name',
      }),
    ]);
    return Response.json({
      success: true,
      usedIntake: !!intakeContent,
      files: [phFile.data, jdFile.data],
    });
  } catch (err) {
    return Response.json({ error: 'Drive save failed: ' + err.message }, { status: 500 });
  }
}
