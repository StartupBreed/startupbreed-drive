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
- Never invent or guess funding amounts, exact employee counts, or legal entity names. Only state what you can confirm from the intake.
- Keep all language professional, warm, and written for a candidate reading it — not internal notes.
- If Additional Notes are provided, extract relevant info and map to the correct fields. Do not dump raw notes into any single field.

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
  "similarJobTitles": "2-3 similar job titles for this role",
  "level": "${seniority || 'To be confirmed'}",
  "salaryRange": "${salaryRange || 'To be confirmed'}",
  "workArrangement": "On-site / Hybrid / Remote — infer from company info in intake",
  "goalsExpectation": "Key goals and expectations for the first 3-6 months in this specific role",
  "teamCulture": "Inferred from company culture described in the intake",
  "worksWith": "Likely teams and stakeholders this role collaborates with",
  "responsibilities": ["Write 8-10 bullet points. Each starts with an action verb. Tailor every point to the exact role, company stage, and industry. Do not copy-paste from a generic job description. Make each point specific and meaningful.", "..."],
  "qualifications": ["List required and preferred qualifications — education, certifications, years of experience specific to this role", "..."],
  "nonNegotiable": ["Must-have skill or experience — absolutely necessary for success in this role", "...up to 6 total"],
  "niceToHave": ["Desirable but not essential skill or experience", "...up to 5 total"],
  "requestToConnect": "LinkedIn Request to Connect — max 300 characters. Brief and professional. Emphasize candidate alignment with key aspects of the role. Highlight company USPs. Invite to connect. Follow this style: Hi K.Name, we are looking for a ${positionName} (${salaryRange || 'competitive salary'}) for ${companyName}; a leading [company description]. The company offers [USP]. May I tell you more? 🙂",
  "afterConnection": "LinkedIn message after connection. Express that you represent StartupBreed as the recruiter for this client. Highlight the main responsibilities and key skills needed for the ${positionName} role. Encourage the candidate to schedule a call and mention you will attach the JD. Tone: friendly, professional, rapport-building — not salesy.",
  "generalQuestions": [{"q": "General/introduction question about background and experience", "a": "Short, clear, realistic expected answer in first-person quote style, e.g. 'I have X years of experience in...' demonstrating relevant background"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}],
  "specificQuestions": [{"q": "Specific question tailored to this exact role, company, and industry", "a": "Expected answer showing technical or role-specific knowledge in first-person quote style, e.g. 'In my previous role, I...' — short, clear, realistic"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}],
  "compensationQuestions": [{"q": "Compensation or logistics question", "a": "Expected answer in first-person quote style, e.g. 'My current salary is...' — short and direct"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]
}

Generate 3-4 generalQuestions, 5-7 specificQuestions, and 3-4 compensationQuestions (10-15 total). Each expected answer must be short, clear, concise, and realistic — written in first-person quote style that showcases the candidate's qualifications, leadership abilities, and problem-solving skills.

"jobDescription" should be an object with these keys:
{
  "aboutCompany": "3-4 sentences covering mission, values, culture, and notable achievements. Written for a candidate reading about the company for the first time.",
  "aboutRole": "2-3 sentences on the purpose of this role and how it fits into the overall company structure.",
  "responsibilities": ["8-10 bullet points. Each starts with an action verb. Specific to this role and company — not generic.", "..."],
  "qualifications": ["Required and preferred: education, skills, years of experience, certifications", "..."],
  "languageProficiency": "Required and preferred languages and proficiency level",
  "benefits": ["List company benefits from intake if available, otherwise write: Competitive package — details to be confirmed", "..."],
  "workingConditions": "Location, remote/on-site/hybrid, working hours",
  "learnMore": "Website and LinkedIn URLs from the intake"
}`;
}

function buildPreHuntHTML({ positionName, companyName, seniority, salaryRange, data }) {
  const P = "font-family:'Poppins',Arial,sans-serif;";
  // Section header: no top margin (space comes from table's margin-bottom), tight bottom so line sits close
  const H2 = `color:#424495;font-weight:600;font-size:10pt;margin:0 0 2px 0;padding:0;${P}`;
  // Divider: no top margin (tight under header), 10px below before table
  const HR = '<hr style="border:none;border-top:1.5px solid #a0a0a0;margin:0 0 10px 0;padding:0;">';
  // Table: bottom margin creates space before next section header
  const TBL = `width:100%;border-collapse:collapse;margin:0 0 22px 0;font-size:10pt;`;
  const LBL = `padding:10px 14px;border:1px solid #000;width:30%;vertical-align:top;line-height:1.6;color:#000;background:#F7F7F7;${P}font-size:10pt;`;
  const VAL = `padding:10px 14px;border:1px solid #000;vertical-align:top;line-height:1.6;color:#000;${P}font-size:10pt;`;
  const TH  = `padding:9px 14px;border:1px solid #000;vertical-align:middle;line-height:1.4;color:#000;font-weight:600;background:#F7F7F7;${P}font-size:10pt;`;
  const TBC = '<span style="color:#999;font-style:italic;">To be confirmed</span>';

  const row = (label, value) => `
    <tr>
      <td style="${LBL}">${label}</td>
      <td style="${VAL}">${value || TBC}</td>
    </tr>`;

  const bullets = (arr) =>
    `<ul style="margin:2px 0 0 0;padding-left:20px;">${(arr || []).map(i =>
      `<li style="margin-bottom:4px;line-height:1.6;">${i}</li>`).join('')}</ul>`;

  const qaRows = (qs) => (qs || []).map(({ q, a }) => `
    <tr>
      <td style="${VAL}">${q}</td>
      <td style="${VAL}color:#444;">${a}</td>
    </tr>`).join('');

  const catRow = (label) => `
    <tr>
      <td colspan="2" style="${LBL}width:auto;font-weight:600;color:#424495;">${label}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
  <style>* { box-sizing: border-box; } body { margin:0; padding:0; }</style>
</head>
<body style="${P}font-size:10pt;margin:52px 60px;color:#000;line-height:1.6;">

<h1 style="font-size:15pt;font-weight:600;color:#424495;margin:0 0 2px 0;padding:0;${P}">Position Name: ${positionName}</h1>
${HR}
<p style="margin:0 0 4px 0;padding:0;${P}font-size:10pt;">Company: &nbsp;<strong>${companyName}</strong></p>
<p style="margin:0 0 16px 0;padding:0;${P}font-size:10pt;">Company Intake: &nbsp;See Client Intake_ ${companyName}</p>
${HR}

<h2 style="${H2}">PoC Contact Details</h2>
${HR}
<table style="${TBL}">
  ${row('Name', TBC)}
  ${row('Position', TBC)}
  ${row('Phone Number', TBC)}
  ${row('Email', TBC)}
</table>

<h2 style="${H2}">Position Summary</h2>
${HR}
<table style="${TBL}">
  ${row('Position Name', positionName)}
  ${row('Similar Job Titles', data.similarJobTitles)}
  ${row('Level', data.level || seniority || TBC)}
  ${row('Candidate Start Date', TBC)}
  ${row('Salary Range', data.salaryRange || salaryRange || TBC)}
  ${row('Package Details', TBC)}
  ${row('Work Arrangement', data.workArrangement)}
  ${row('Goals / Expectation', data.goalsExpectation)}
  ${row('New Hire / Replacement', TBC)}
</table>

<h2 style="${H2}">Team Environment</h2>
${HR}
<table style="${TBL}">
  ${row('Hiring Manager', 'Name: &nbsp;To be confirmed<br>Position: &nbsp;To be confirmed')}
  ${row('Works Closely With', data.worksWith)}
  ${row('Team Size', TBC)}
  ${row('Team Culture', data.teamCulture)}
</table>

<h2 style="${H2}">Skills &amp; Competencies</h2>
${HR}
<table style="${TBL}">
  ${row('Responsibilities', bullets(data.responsibilities))}
  ${row('Qualifications', bullets(data.qualifications))}
  ${row('Non-Negotiable', bullets(data.nonNegotiable))}
  ${row('Nice-to-Have', bullets(data.niceToHave))}
</table>

<h2 style="${H2}">Other Notes</h2>
${HR}
<table style="${TBL}">
  <tr><td style="${VAL}" colspan="2" height="48">&nbsp;</td></tr>
</table>

<h2 style="${H2}">Client's Interview Process</h2>
${HR}
<table style="${TBL}">
  <tr>
    <td style="${TH};width:5%;text-align:center;">No.</td>
    <td style="${TH};width:30%;">Interview Process</td>
    <td style="${TH};width:13%;">Type</td>
    <td style="${TH};width:20%;">By Who</td>
    <td style="${TH}">What is Being Assessed?</td>
  </tr>
  <tr>
    <td style="${VAL}text-align:center;">1</td><td style="${VAL}">&nbsp;</td>
    <td style="${VAL}">Online</td><td style="${VAL}">&nbsp;</td><td style="${VAL}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${VAL}text-align:center;">2</td><td style="${VAL}">&nbsp;</td>
    <td style="${VAL}">Online</td><td style="${VAL}">&nbsp;</td><td style="${VAL}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${VAL}text-align:center;">3</td><td style="${VAL}">&nbsp;</td>
    <td style="${VAL}">Online</td><td style="${VAL}">&nbsp;</td><td style="${VAL}">&nbsp;</td>
  </tr>
</table>

<h2 style="${H2}">Outreach Messages</h2>
${HR}
<table style="${TBL}">
  ${row('Request to Connect <span style="font-weight:400;font-size:9pt;color:#888;">(max 300 chars)</span>', data.requestToConnect)}
  ${row('After Connection', data.afterConnection)}
</table>

<h2 style="${H2}">Phone Screening Questions</h2>
${HR}
<table style="${TBL}">
  <tr>
    <td style="${TH};width:50%;">Question</td>
    <td style="${TH}">Expected Answer</td>
  </tr>
  ${catRow('General / Introduction Questions')}
  ${qaRows(data.generalQuestions)}
  ${catRow('Specific Questions')}
  ${qaRows(data.specificQuestions)}
  ${catRow('Compensation Questions')}
  ${qaRows(data.compensationQuestions)}
</table>

<h2 style="${H2}">Note Screening Structure</h2>
${HR}
<table style="${TBL}">
  <tr>
    <td style="${VAL}line-height:2.2;">
      <strong>Firstname Lastname (Nickname)</strong><br>
      Current compensation: <br>
      Expectations: <br>
      Notice period: <br>
      Notes:
    </td>
  </tr>
</table>

</body></html>`;
}

function buildJDHTML({ positionName, companyName, data }) {
  const P = "font-family:'Poppins',Arial,sans-serif;";
  const H2  = `color:#424495;font-weight:600;font-size:10pt;margin:0 0 2px 0;padding:0;${P}`;
  const HR  = '<hr style="border:none;border-top:1.5px solid #a0a0a0;margin:0 0 10px 0;padding:0;">';
  const BDY = `margin:0 0 22px 0;padding:0;line-height:1.6;color:#000;${P}font-size:10pt;`;

  const bullets = (arr) =>
    `<ul style="margin:2px 0 0 0;padding-left:20px;">${(arr || []).map(i =>
      `<li style="margin-bottom:5px;line-height:1.6;">${i}</li>`).join('')}</ul>`;

  return `<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
  <style>* { box-sizing: border-box; } body { margin:0; padding:0; }</style>
</head>
<body style="${P}font-size:10pt;margin:52px 60px;color:#000;line-height:1.6;">

<h1 style="font-size:15pt;font-weight:600;color:#424495;margin:0 0 2px 0;padding:0;${P}">${companyName}: ${positionName}</h1>
${HR}
<p style="margin:0 0 22px 0;padding:0;">&nbsp;</p>

<h2 style="${H2}">About the Company</h2>
${HR}
<p style="${BDY}">${data.aboutCompany}</p>

<h2 style="${H2}">About the Role</h2>
${HR}
<p style="${BDY}">${data.aboutRole}</p>

<h2 style="${H2}">Responsibilities</h2>
${HR}
<div style="${BDY}">${bullets(data.responsibilities)}</div>

<h2 style="${H2}">Qualifications</h2>
${HR}
<div style="${BDY}">${bullets(data.qualifications)}</div>

<h2 style="${H2}">Language Proficiency</h2>
${HR}
<p style="${BDY}">${data.languageProficiency || 'Thai (Native), English (Conversational or above)'}</p>

<h2 style="${H2}">Benefits</h2>
${HR}
<div style="${BDY}">${bullets(data.benefits)}</div>

<h2 style="${H2}">Working Conditions</h2>
${HR}
<p style="${BDY}">${data.workingConditions}</p>

<h2 style="${H2}">Learn More About the Company</h2>
${HR}
<p style="${BDY}">${data.learnMore}</p>

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
