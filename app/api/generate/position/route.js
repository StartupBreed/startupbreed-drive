import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function readClientIntake(drive, clientFolderId) {
  const res = await drive.files.list({
    q: `'${clientFolderId}' in parents and trashed = false and name contains 'Client Intake'`,
    fields: 'files(id, name)',
    pageSize: 5,
  });
  const file = res.data.files?.[0];
  if (!file) return null;
  try {
    const content = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
    return content.data;
  } catch {
    const content = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
    return content.data;
  }
}

function buildPrompt({ positionName, companyName, seniority, salaryRange, additionalNote, intakeContent }) {
  return `You are a professional recruitment consultant at a headhunting firm. Using the Client Intake below as company context, generate a Pre-hunt document and a Job Description.

Global rules:
- Never leave placeholder text in output. Replace every field with real generated content.
- Use [To be confirmed] only for fields that genuinely require real client input: PoC contact details, Interview Process rows, Package Details, Candidate Start Date.
- Keep all language professional, warm, and written for a candidate reading it.
- If Additional Notes are provided, extract relevant info and map to the correct fields.

CLIENT INTAKE (company context):
${intakeContent || `Company: ${companyName}. No intake available — infer from company name.`}

POSITION:
Position Name: ${positionName}
Company: ${companyName}
Seniority Level: ${seniority || 'Not specified'}
Salary Range: ${salaryRange || 'To be confirmed'}
Additional Note: ${additionalNote || 'None'}

Return ONLY a valid JSON object with exactly two keys: "preHunt" and "jobDescription". No markdown, no explanation.

"preHunt" should be an object with these keys:
{
  "similarJobTitles": "2-3 similar titles for this role",
  "level": "${seniority || 'To be confirmed'}",
  "salaryRange": "${salaryRange || 'To be confirmed'}",
  "workArrangement": "On-site / Hybrid / Remote — infer from company info",
  "goalsExpectation": "Key goals and expectations for the first 3-6 months in this specific role",
  "teamCulture": "Inferred from company culture in the intake",
  "worksWith": "Likely teams and stakeholders this role collaborates with",
  "responsibilities": ["Write 8-10 bullet points. Each starts with an action verb. Tailor every point to the exact role, company stage, and industry. Do not copy-paste from a generic job description. Make each point specific and meaningful.", "..."],
  "qualifications": ["Required and preferred qualifications — education, certifications, years of experience specific to this role", "..."],
  "nonNegotiable": ["Must-have skill or experience 1 — absolutely necessary for success in this role", "...up to 6"],
  "niceToHave": ["Desirable but not essential skill 1", "...up to 5"],
  "requestToConnect": "LinkedIn Request to Connect — max 300 characters. Brief and professional. Emphasize candidate alignment with key aspects of the role. Highlight company USPs. Invite to connect. Example style: Hi K.Name, we are looking for a ${positionName} (${salaryRange || 'competitive salary'}) for ${companyName}; a leading [company description]. The company offers [USP]. May I tell you more?",
  "afterConnection": "LinkedIn message after connection. Express that you represent StartupBreed as the recruiter. Highlight main responsibilities and skills needed. Encourage scheduling a call. Mention attaching the JD. Friendly, professional, rapport-building tone.",
  "generalQuestions": [{"q": "General/intro question 1", "a": "Short, clear, realistic expected answer demonstrating relevant experience"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}],
  "specificQuestions": [{"q": "Specific question 1 tailored to this exact role and company", "a": "Expected answer showing technical and role-specific knowledge"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}],
  "compensationQuestions": [{"q": "Compensation question 1", "a": "Expected answer"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]
}

"jobDescription" should be an object with these keys:
{
  "aboutCompany": "3-4 sentences covering mission, values, culture, and notable achievements. Written for a candidate reading about the company for the first time.",
  "aboutRole": "2-3 sentences on the purpose of this role and how it fits into the overall company structure.",
  "responsibilities": ["8-10 bullet points. Each starts with an action verb. Specific to this role and company — not generic.", "..."],
  "qualifications": ["Required and preferred: education, skills, years of experience, certifications", "..."],
  "languageProficiency": "Required and preferred languages and proficiency level",
  "benefits": ["List company benefits from intake if available, or Competitive package — details to be confirmed", "..."],
  "workingConditions": "Location, remote/on-site/hybrid, working hours",
  "learnMore": "Website and LinkedIn from intake"
}`;
}

function buildPreHuntHTML({ positionName, companyName, seniority, salaryRange, data }) {
  const tableStyle = 'width:100%;border-collapse:collapse;margin-bottom:16px;';
  const labelStyle = 'background:#f3f3f3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:35%;vertical-align:top;';
  const valueStyle = 'padding:8px 12px;border:1px solid #ccc;vertical-align:top;';
  const h2Style = 'background:#4a4a4a;color:white;padding:8px 12px;margin:24px 0 8px 0;font-size:14px;';
  const tbc = '<span style="color:#999">To be confirmed</span>';

  const row = (label, value) => `
    <tr>
      <td style="${labelStyle}">${label}</td>
      <td style="${valueStyle}">${value || tbc}</td>
    </tr>`;

  const bulletList = (arr) => (arr || []).map(item => `• ${item}`).join('<br>');

  const qaRows = (questions) => (questions || []).map(({ q, a }) => `
    <tr>
      <td style="${valueStyle}">${q}</td>
      <td style="${valueStyle}">${a}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:12px;margin:32px;">

<h1 style="font-size:18px;margin-bottom:4px;">Position Name: ${positionName}</h1>
<p style="margin:4px 0;"><strong>Company:</strong> ${companyName}</p>
<p style="margin:4px 0;"><strong>Company Intake:</strong> See Client Intake_ ${companyName}</p>

<h2 style="${h2Style}">PoC Contact Details</h2>
<table style="${tableStyle}">
  ${row('Name', tbc)}
  ${row('Position', tbc)}
  ${row('Phone Number', tbc)}
  ${row('Email', tbc)}
</table>

<h2 style="${h2Style}">Position Summary</h2>
<table style="${tableStyle}">
  ${row('Position Name', positionName)}
  ${row('Similar Job Titles', data.similarJobTitles)}
  ${row('Level', data.level || seniority || tbc)}
  ${row('Candidate Start Date', tbc)}
  ${row('Salary Range', data.salaryRange || salaryRange || tbc)}
  ${row('Package Details', tbc)}
  ${row('Work Arrangement', data.workArrangement)}
  ${row('Goals/Expectation', data.goalsExpectation)}
  ${row('New Hire/Replacement', tbc)}
</table>

<h2 style="${h2Style}">Team Environment</h2>
<table style="${tableStyle}">
  ${row('Hiring Manager', 'Name: To be confirmed<br>Position: To be confirmed')}
  ${row('Works closely with', data.worksWith)}
  ${row('Team Size', tbc)}
  ${row('Team Culture', data.teamCulture)}
</table>

<h2 style="${h2Style}">Skills & Competencies</h2>
<table style="${tableStyle}">
  ${row('Responsibilities', bulletList(data.responsibilities))}
  ${row('Qualifications', bulletList(data.qualifications))}
  ${row('Non-negotiable', bulletList(data.nonNegotiable))}
  ${row('Nice-to-have', bulletList(data.niceToHave))}
</table>

<h2 style="${h2Style}">Other Notes</h2>
<table style="${tableStyle}">
  <tr><td style="${valueStyle}">&nbsp;</td></tr>
</table>

<h2 style="${h2Style}">Client's Interview Process</h2>
<table style="${tableStyle}">
  <tr>
    <td style="${labelStyle}">No.</td>
    <td style="${labelStyle}">Interview Process</td>
    <td style="${labelStyle}">Type</td>
    <td style="${labelStyle}">By Who</td>
    <td style="${labelStyle}">What is being assessed?</td>
  </tr>
  <tr>
    <td style="${valueStyle}">1</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${valueStyle}">2</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${valueStyle}">3</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td>
    <td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">&nbsp;</td>
  </tr>
</table>

<h2 style="${h2Style}">Outreach Messages</h2>
<table style="${tableStyle}">
  ${row('Request to Connect', data.requestToConnect)}
  ${row('After Connection', data.afterConnection)}
</table>

<h2 style="${h2Style}">Phone Screening Questions</h2>
<table style="${tableStyle}">
  <tr>
    <td style="${labelStyle}">Question</td>
    <td style="${labelStyle}">Answer</td>
  </tr>
  <tr>
    <td colspan="2" style="background:#e8f0fe;font-weight:bold;padding:8px 12px;border:1px solid #ccc;">General/Introduction Questions</td>
  </tr>
  ${qaRows(data.generalQuestions)}
  <tr>
    <td colspan="2" style="background:#e8f0fe;font-weight:bold;padding:8px 12px;border:1px solid #ccc;">Specific Questions</td>
  </tr>
  ${qaRows(data.specificQuestions)}
  <tr>
    <td colspan="2" style="background:#e8f0fe;font-weight:bold;padding:8px 12px;border:1px solid #ccc;">Compensation Questions</td>
  </tr>
  ${qaRows(data.compensationQuestions)}
</table>

<h2 style="${h2Style}">Note Screening Structure</h2>
<table style="${tableStyle}">
  <tr><td style="${valueStyle}">
    <strong>Firstname Lastname (Nickname)</strong><br>
    Current compensation: <br>
    Expectations: <br>
    Notice period: <br>
    Notes:
  </td></tr>
</table>

</body></html>`;
}

function buildJDHTML({ positionName, companyName, data }) {
  const h2Style = 'background:#4a4a4a;color:white;padding:8px 12px;margin:24px 0 8px 0;font-size:14px;';
  const sectionStyle = 'padding:8px 0 16px 0;border-bottom:1px solid #eee;';
  const bulletList = (arr) => (arr || []).map(item => `• ${item}`).join('<br>');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:12px;margin:32px;">

<h1 style="font-size:20px;margin-bottom:4px;">${companyName}: ${positionName}</h1>

<h2 style="${h2Style}">About the Company</h2>
<p style="${sectionStyle}">${data.aboutCompany}</p>

<h2 style="${h2Style}">About the Role</h2>
<p style="${sectionStyle}">${data.aboutRole}</p>

<h2 style="${h2Style}">Responsibilities</h2>
<p style="${sectionStyle}">${bulletList(data.responsibilities)}</p>

<h2 style="${h2Style}">Qualifications</h2>
<p style="${sectionStyle}">${bulletList(data.qualifications)}</p>

<h2 style="${h2Style}">Language Proficiency</h2>
<p style="${sectionStyle}">${data.languageProficiency || 'Thai (Native), English (Conversational or above)'}</p>

<h2 style="${h2Style}">Benefits</h2>
<p style="${sectionStyle}">${bulletList(data.benefits)}</p>

<h2 style="${h2Style}">Working Conditions</h2>
<p style="${sectionStyle}">${data.workingConditions}</p>

<h2 style="${h2Style}">Learn More About the Company</h2>
<p style="${sectionStyle}">${data.learnMore}</p>

</body></html>`;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { positionName, companyName, seniority, salaryRange, positionFolderId, clientFolderId } = body;
  if (!positionName || !positionFolderId || !clientFolderId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  const intakeContent = await readClientIntake(drive, clientFolderId);

  let parsed;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: 'You are a professional recruitment consultant. Return only valid JSON, no markdown, no explanation.',
      messages: [{ role: 'user', content: buildPrompt({ ...body, intakeContent }) }],
    });
    const text = message.content[0].text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    return Response.json({ error: 'Generation failed: ' + err.message }, { status: 500 });
  }

  const phHTML = buildPreHuntHTML({ positionName, companyName, seniority, salaryRange, data: parsed.preHunt });
  const jdHTML = buildJDHTML({ positionName, companyName, data: parsed.jobDescription });

  try {
    const [phFile, jdFile] = await Promise.all([
      drive.files.create({
        requestBody: {
          name: `Pre-hunt_ ${companyName}_${positionName}`,
          parents: [positionFolderId],
          mimeType: 'application/vnd.google-apps.document',
        },
        media: { mimeType: 'text/html', body: Readable.from(phHTML) },
        fields: 'id, name',
      }),
      drive.files.create({
        requestBody: {
          name: `JD_${companyName}_${positionName}`,
          parents: [positionFolderId],
          mimeType: 'application/vnd.google-apps.document',
        },
        media: { mimeType: 'text/html', body: Readable.from(jdHTML) },
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
