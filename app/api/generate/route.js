import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ companyName, positionName, seniority, salaryRange, website, linkedin, additionalNote }) {
  return `Generate three recruitment documents for the following company and position. Return ONLY a valid JSON object with exactly three keys: "clientIntake", "preHunt", "jobDescription". Each value is the complete formatted document as plain text. No markdown code blocks, no explanation — just the raw JSON.

Company Name: ${companyName}
Position Name: ${positionName}
Seniority Level: ${seniority || 'Not specified'}
Salary Range: ${salaryRange || 'Not specified'}
Website: ${website || 'Not specified'}
LinkedIn: ${linkedin || 'Not specified'}
Additional Note: ${additionalNote || 'None'}

---

CLIENT INTAKE DOCUMENT INSTRUCTIONS:
Fill in every field below using public information about the company. Never leave template placeholders. Use "[To be confirmed]" only for fields requiring real client input (PoC details, Registration Number, exact funding amounts you cannot verify). Write professionally for a candidate reading this.

Structure:
Company Name: [name]
Intake by: StartupBreed
Date: ${new Date().toLocaleDateString('en-GB')}

GENERAL INFORMATION
Registered Name: [full legal name or "To be confirmed"]
Registration Number: [or "To be confirmed"]
Industry: [1-3 word label]
Company Size: [employee count + brief note]
Current Funding: [funding status, rounds, investors if public]
Office Location(s): [all locations]

COMPANY INFORMATION
Elevator Pitch: [2-3 professional sentences covering what the company does, who it serves, and what makes it compelling]
Mission: [one sentence]
Vision: [one sentence]
Company Background: [3-5 sentences: founding year, founders, milestones, current stage]
Services/Products: [list each product/service with one-sentence description, up to 6]
Unique Selling Points: [4-6 specific, concrete USPs — not generic filler]
Target Market: [primary customer segments]
Main Competitors: [3-6 direct competitors by name]

COMPANY CULTURE & VALUES
Company Culture: [3-5 sentences about work environment, management style, team dynamics]
Qualities Valued in Employees: [5-7 specific attributes — not generic like "hardworking"]

RESOURCES
Website: ${website || '[To be confirmed]'}
LinkedIn: ${linkedin || '[To be confirmed]'}

---

PRE-HUNT DOCUMENT INSTRUCTIONS:
Fill in every field. Use the company information to generate Skills & Competencies, Outreach Messages, and Phone Screening Questions. Use "[To be confirmed]" for fields requiring direct client input (PoC details, Interview Process specifics, exact package details).

Structure:
Position Name: ${positionName}
Company: ${companyName}
Company Intake: [Reference to the client intake document]

POC CONTACT DETAILS
Name: [To be confirmed]
Position: [To be confirmed]
Phone Number: [To be confirmed]
Email: [To be confirmed]

POSITION SUMMARY
Position Name: ${positionName}
Similar Job Titles: [2-3 similar titles]
Level: ${seniority || '[Entry / Associate / Senior / Manager / Director / Executive]'}
Candidate Start Date: [To be confirmed]
Salary Range: ${salaryRange || '[To be confirmed]'}
Package Details: [To be confirmed]
Work Arrangement: [On-site / Hybrid / Remote — based on company info]
Goals/Expectation: [Key goals for the first 3-6 months]
New Hire/Replacement: [To be confirmed]

TEAM ENVIRONMENT
Hiring Manager Name: [To be confirmed]
Hiring Manager Position: [To be confirmed]
Works Closely With: [likely teams based on role]
Team Size: [To be confirmed]
Team Culture: [inferred from company culture]

SKILLS & COMPETENCIES
Responsibilities: [8-10 bullet points starting with action verbs, specific to this role and company]
Qualifications: [required education, experience, certifications]
Non-Negotiable: [4-6 must-have skills/experience]
Nice-to-Have: [3-5 desirable but not essential skills]

CLIENT'S INTERVIEW PROCESS
1. [To be confirmed] | Online | [To be confirmed] | [What is assessed]
2. [To be confirmed] | Online | [To be confirmed] | [What is assessed]
3. [To be confirmed] | Online | [To be confirmed] | [What is assessed]

OUTREACH MESSAGES
Request to Connect (max 300 chars): [Brief professional message highlighting role alignment and USPs]
After Connection: [Warm message representing StartupBreed as the recruiter, mentioning key responsibilities, inviting a call]

PHONE SCREENING QUESTIONS
Format as Question | Expected Answer pairs, organized in three groups:
General/Introduction Questions (3 questions)
Specific Questions (6 questions tailored to the role)
Compensation Questions (4 questions)

NOTE SCREENING STRUCTURE:
Firstname Lastname (Nickname)
Current compensation:
Expectations:
Notice period:
Notes: [key experience points for this role]

---

JOB DESCRIPTION INSTRUCTIONS:
Create a complete, professional job description ready to post.

Structure:
${companyName}: ${positionName}

About the Company: [3-4 sentences covering mission, values, culture, notable achievements]
About the Role: [2-3 sentences on purpose of role and how it fits the company]
Responsibilities: [8-10 bullet points, action verbs, specific to this role]
Qualifications: [required and preferred — education, skills, experience, certifications]
Language Proficiency: [required languages and level]
Benefits: [list company benefits — use public info or "Competitive package to be confirmed"]
Working Conditions: [location, remote/on-site, hours]
Learn More About the Company: [Website: ${website || '[URL]'} | LinkedIn: ${linkedin || '[URL]'}]`;
}

async function createDriveFile(drive, name, content, parentId) {
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId], mimeType: 'text/plain' },
    media: { mimeType: 'text/plain', body: Readable.from(content) },
    fields: 'id, name',
  });
  return res.data;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyName, positionName, seniority, salaryRange, website, linkedin, additionalNote, folderId } = body;

  if (!companyName || !positionName || !folderId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Call Claude API
  let parsed;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: 'You are an expert recruitment consultant at a professional headhunting firm. Generate detailed, professional recruitment documents. Always return a single valid JSON object with keys "clientIntake", "preHunt", "jobDescription". No markdown, no explanation outside the JSON.',
      messages: [{ role: 'user', content: buildPrompt(body) }],
    });

    const text = message.content[0].text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    return Response.json({ error: 'Claude generation failed: ' + err.message }, { status: 500 });
  }

  // Save files to Google Drive
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const [ciFile, phFile, jdFile] = await Promise.all([
      createDriveFile(drive, `Client Intake_ ${companyName}.txt`, parsed.clientIntake, folderId),
      createDriveFile(drive, `Pre-hunt_ ${companyName}_${positionName}.txt`, parsed.preHunt, folderId),
      createDriveFile(drive, `JD_${companyName}_${positionName}.txt`, parsed.jobDescription, folderId),
    ]);
    return Response.json({ success: true, files: [ciFile, phFile, jdFile] });
  } catch (err) {
    return Response.json({ error: 'Drive save failed: ' + err.message }, { status: 500 });
  }
}
