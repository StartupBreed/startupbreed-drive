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
  const poppins = "font-family:'Poppins',Arial,sans-serif;";
  const tableStyle = `width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10pt;`;
  const labelStyle = `padding:10px 14px;border:1px solid #000;width:32%;vertical-align:top;color:#000;background:#F7F7F7;${poppins}font-size:10pt;`;
  const valueStyle = `padding:10px 14px;border:1px solid #000;vertical-align:top;color:#000;${poppins}font-size:10pt;`;
  const thStyle = `padding:10px 14px;border:1px solid #000;vertical-align:top;color:#000;font-weight:600;background:#F7F7F7;${poppins}font-size:10pt;`;
  const h2Style = `color:#424495;font-weight:600;font-size:10pt;margin:24px 0 2px 0;${poppins}`;
  const divider = '<hr style="border:none;border-top:1.5px solid #a0a0a0;margin:4px 0 10px 0;">';
  const tbc = '<span style="color:#aaa">To be confirmed</span>';

  const row = (label, value) => `
    <tr>
      <td style="${labelStyle}">${label}</td>
      <td style="${valueStyle}">${value || tbc}</td>
    </tr>`;

  const bullets = (arr) => (arr || []).map(item => `• &nbsp;${item}`).join('<br>');

  const qaRows = (questions) => (questions || []).map(({ q, a }) => `
    <tr>
      <td style="${valueStyle}">${q}</td>
      <td style="${valueStyle}">${a}</td>
    </tr>`).join('');

  const categoryRow = (label) => `
    <tr>
      <td colspan="2" style="font-weight:600;padding:8px 14px;border:1px solid #000;color:#000;background:#F7F7F7;${poppins}font-size:10pt;">${label}</td>
    </tr>`;

  return `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet"></head><body style="${poppins}font-size:10pt;margin:40px 48px;color:#000;">

<h1 style="font-size:15pt;font-weight:600;color:#424495;margin-bottom:4px;${poppins}">Position Name: ${positionName}</h1>
${divider}
<p style="margin:6px 0;${poppins}font-size:10pt;">Company: &nbsp;<strong>${companyName}</strong></p>
<p style="margin:6px 0 16px 0;${poppins}font-size:10pt;">Company Intake: &nbsp;See Client Intake_ ${companyName}</p>
${divider}

<h2 style="${h2Style}">PoC Contact Details</h2>
${divider}
<table style="${tableStyle}">
  ${row('Name', tbc)}
  ${row('Position', tbc)}
  ${row('Phone Number', tbc)}
  ${row('Email', tbc)}
</table>

<h2 style="${h2Style}">Position Summary</h2>
${divider}
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
${divider}
<table style="${tableStyle}">
  ${row('Hiring Manager', 'Name: To be confirmed<br>Position: To be confirmed')}
  ${row('Works closely with (Optional)', data.worksWith)}
  ${row('Team Size', tbc)}
  ${row('Team Culture (Optional)', data.teamCulture)}
</table>

<h2 style="${h2Style}">Skills &amp; Competencies</h2>
${divider}
<table style="${tableStyle}">
  ${row('Responsibilities', bullets(data.responsibilities))}
  ${row('Qualifications', bullets(data.qualifications))}
  ${row('Non-negotiable', bullets(data.nonNegotiable))}
  ${row('Nice-to-have', bullets(data.niceToHave))}
</table>

<h2 style="${h2Style}">Other Notes</h2>
${divider}
<table style="${tableStyle}">
  <tr><td style="${valueStyle}" colspan="2">&nbsp;<br>&nbsp;</td></tr>
</table>

<h2 style="${h2Style}">Client's Interview Process</h2>
${divider}
<table style="${tableStyle}">
  <tr>
    <td style="${thStyle};width:5%;">No.</td>
    <td style="${thStyle}">Interview Process</td>
    <td style="${thStyle}">Type</td>
    <td style="${thStyle}">By Who</td>
    <td style="${thStyle}">What is being assessed?</td>
  </tr>
  <tr>
    <td style="${valueStyle}">1</td><td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td><td style="${valueStyle}">&nbsp;</td><td style="${valueStyle}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${valueStyle}">2</td><td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td><td style="${valueStyle}">&nbsp;</td><td style="${valueStyle}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${valueStyle}">3</td><td style="${valueStyle}">&nbsp;</td>
    <td style="${valueStyle}">Online</td><td style="${valueStyle}">&nbsp;</td><td style="${valueStyle}">&nbsp;</td>
  </tr>
</table>

<h2 style="${h2Style}">Outreach Messages</h2>
${divider}
<table style="${tableStyle}">
  ${row('Request to Connect', data.requestToConnect)}
  ${row('After Connection', data.afterConnection)}
</table>

<h2 style="${h2Style}">Phone Screening Questions</h2>
${divider}
<table style="${tableStyle}">
  <tr>
    <td style="${thStyle};width:50%;">Question</td>
    <td style="${thStyle}">Answer</td>
  </tr>
  ${categoryRow('General/Introduction Questions')}
  ${qaRows(data.generalQuestions)}
  ${categoryRow('Specific Questions')}
  ${qaRows(data.specificQuestions)}
  ${categoryRow('Compensation Questions')}
  ${qaRows(data.compensationQuestions)}
</table>

<h2 style="${h2Style}">Note Screening Structure</h2>
${divider}
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
  const poppins = "font-family:'Poppins',Arial,sans-serif;";
  const h2Style = `color:#424495;font-weight:600;font-size:10pt;margin:24px 0 2px 0;${poppins}`;
  const divider = '<hr style="border:none;border-top:1.5px solid #a0a0a0;margin:4px 0 10px 0;">';
  const sectionStyle = `margin:0 0 8px 0;line-height:1.7;color:#000;${poppins}font-size:10pt;`;
  const bullets = (arr) => (arr || []).map(item => `• &nbsp;${item}`).join('<br>');

  return `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet"></head><body style="${poppins}font-size:10pt;margin:40px 48px;color:#000;">

<h1 style="font-size:15pt;font-weight:600;color:#424495;margin-bottom:4px;${poppins}">${companyName}: ${positionName}</h1>
${divider}

<h2 style="${h2Style}">About the Company</h2>
${divider}
<p style="${sectionStyle}">${data.aboutCompany}</p>

<h2 style="${h2Style}">About the Role</h2>
${divider}
<p style="${sectionStyle}">${data.aboutRole}</p>

<h2 style="${h2Style}">Responsibilities</h2>
${divider}
<p style="${sectionStyle}">${bullets(data.responsibilities)}</p>

<h2 style="${h2Style}">Qualifications</h2>
${divider}
<p style="${sectionStyle}">${bullets(data.qualifications)}</p>

<h2 style="${h2Style}">Language Proficiency</h2>
${divider}
<p style="${sectionStyle}">${data.languageProficiency || 'Thai (Native), English (Conversational or above)'}</p>

<h2 style="${h2Style}">Benefits</h2>
${divider}
<p style="${sectionStyle}">${bullets(data.benefits)}</p>

<h2 style="${h2Style}">Working Conditions</h2>
${divider}
<p style="${sectionStyle}">${data.workingConditions}</p>

<h2 style="${h2Style}">Learn More About the Company</h2>
${divider}
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
