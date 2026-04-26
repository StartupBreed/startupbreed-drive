import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ companyName, website, linkedin, additionalNote }) {
  return `You are a professional recruitment consultant at a headhunting firm. Research the company "${companyName}" using the website and LinkedIn provided, then fill in every field of the Client Intake form.

Global rules:
- Never leave placeholder text in output. Replace every field with real researched content.
- Use [To be confirmed] ONLY for Registration Number and fields that genuinely require direct client input.
- Never invent or guess funding amounts or legal entity names — only state what you can verify from public sources.
- Keep all language professional, warm, and written for a candidate reading it — not internal notes.
- If Additional Notes are provided, extract relevant information and map it to the correct fields.

Company Name: ${companyName}
Website: ${website || 'Not provided'}
LinkedIn: ${linkedin || 'Not provided'}
Additional Note: ${additionalNote || 'None'}

Return ONLY a valid JSON object with exactly these keys. No markdown, no explanation, just the JSON:

{
  "registeredName": "Full legal registered name. If you cannot verify with confidence from public sources, write: To be confirmed",
  "registrationNumber": "To be confirmed",
  "industry": "1-3 word label, e.g. FinTech / Earned Wage Access or Healthcare Technology",
  "companySize": "Total employee count. If useful add a brief breakdown in one sentence, e.g. ~70 employees, primarily based in Bangkok. Do not write fragmented bullet points.",
  "currentFunding": "Funding status including recent rounds, amounts raised, key investors if public. Only state what you can verify — do not guess amounts.",
  "officeLocations": "All office locations including headquarters and regional offices",
  "elevatorPitch": "2-3 clean professional sentences. Cover what the company does, who it serves, and what makes it compelling to a candidate reading about it for the first time. No bullet points.",
  "mission": "One sentence using the company's own language where available",
  "vision": "One sentence using the company's own language where available",
  "companyBackground": "3-5 sentences covering founding year, founders if notable, key milestones, and current stage or growth trajectory",
  "servicesProducts": ["[Product/Service Name] — one sentence description", "continue up to 6 total"],
  "usp": ["Specific, concrete competitive advantage — not generic filler like 'great team'", "up to 6 total, each meaningfully distinct"],
  "targetMarket": ["Primary customer segment 1", "Primary customer segment 2"],
  "mainCompetitors": "3-6 direct competitors by name, comma-separated",
  "companyCulture": "3-5 sentences describing the real work environment. Cover management style, pace, team dynamics, and what it genuinely feels like to work there. No corporate filler like 'we value excellence'. Be specific and honest.",
  "qualitiesValued": "5-7 specific attributes valued across ALL employees — not just this one role. Make each concrete, e.g. 'Ownership mentality — takes problems from identification to resolution without being asked'. Avoid generic traits like 'hardworking' or 'team player'. Each on its own line."
}`;
}

function buildHTML({ companyName, website, linkedin, date, data }) {
  const P = "font-family:'Poppins',Arial,sans-serif;";
  const tblStyle = `width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10pt;`;
  const lbl = `padding:11px 14px;border:1px solid #000;width:32%;vertical-align:top;line-height:1.55;color:#000;background:#F7F7F7;${P}font-size:10pt;`;
  const val = `padding:11px 14px;border:1px solid #000;vertical-align:top;line-height:1.55;color:#000;${P}font-size:10pt;`;
  const h2  = `color:#424495;font-weight:600;font-size:10pt;margin:28px 0 1px 0;${P}`;
  const div = '<hr style="border:none;border-top:1.5px solid #a0a0a0;margin:0 0 10px 0;">';

  const row = (label, value) => `
    <tr>
      <td style="${lbl}">${label}</td>
      <td style="${val}">${value || '<span style="color:#aaa;font-style:italic;">—</span>'}</td>
    </tr>`;

  const bullets = (arr) =>
    `<ul style="margin:0;padding-left:18px;">${(arr || []).map(item =>
      `<li style="margin-bottom:5px;line-height:1.55;">${item}</li>`).join('')}</ul>`;

  return `<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="${P}font-size:10pt;margin:48px 56px;color:#000;line-height:1.55;">

<h1 style="font-size:15pt;font-weight:600;color:#424495;margin:0 0 1px 0;${P}">Company Name: ${companyName}</h1>
${div}
<p style="margin:5px 0;${P}font-size:10pt;">Intake by: &nbsp;${data.intakeBy || 'StartupBreed'}</p>
<p style="margin:5px 0 18px 0;${P}font-size:10pt;">Date: &nbsp;${date}</p>
${div}

<h2 style="${h2}">General Information</h2>
${div}
<table style="${tblStyle}">
  ${row('Registered Name', data.registeredName)}
  ${row('Registration Number', data.registrationNumber)}
  ${row('Job Industry', data.industry)}
  ${row('Company Size<br><span style="font-weight:400;font-size:9pt;color:#666;">(number of employees)</span>', data.companySize)}
  ${row('Current Funding', data.currentFunding)}
  ${row('Office Location(s)', data.officeLocations)}
</table>

<h2 style="${h2}">Company Information</h2>
${div}
<table style="${tblStyle}">
  ${row('Elevator Pitch', data.elevatorPitch)}
  ${row('Mission / Vision', `<strong>Mission:</strong>&nbsp; ${data.mission}<br><br><strong>Vision:</strong>&nbsp; ${data.vision}`)}
  ${row('Company Background', data.companyBackground)}
  ${row('Services / Products', bullets(data.servicesProducts))}
  ${row('Unique Selling Points (USP)', bullets(data.usp))}
  ${row('Target Market', bullets(data.targetMarket))}
  ${row('Main Competitors', bullets((data.mainCompetitors || '').split(',').map(s => s.trim())))}
</table>

<h2 style="${h2}">Company Culture &amp; Values</h2>
${div}
<table style="${tblStyle}">
  ${row('Company Culture', data.companyCulture)}
  ${row('Qualities Valued in Employees', data.qualitiesValued)}
</table>

<h2 style="${h2}">Resources</h2>
${div}
<table style="${tblStyle}">
  ${row('Website', website ? `<a href="${website}" style="color:#1155CC;">${website}</a>` : '<span style="color:#aaa;font-style:italic;">—</span>')}
  ${row('LinkedIn', linkedin ? `<a href="${linkedin}" style="color:#1155CC;">${linkedin}</a>` : '<span style="color:#aaa;font-style:italic;">—</span>')}
</table>

</body></html>`;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyName, website, linkedin, additionalNote, folderId } = body;
  if (!companyName || !folderId) return Response.json({ error: 'Missing required fields' }, { status: 400 });

  let data;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: 'You are a professional recruitment consultant. Return only valid JSON, no markdown, no explanation.',
      messages: [{ role: 'user', content: buildPrompt(body) }],
    });
    const text = message.content[0].text.trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    data = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    return Response.json({ error: 'Generation failed: ' + err.message }, { status: 500 });
  }

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = buildHTML({ companyName, website, linkedin, date, data });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.create({
      requestBody: {
        name: `Client Intake_ ${companyName}`,
        parents: [folderId],
        mimeType: 'application/vnd.google-apps.document',
      },
      media: { mimeType: 'text/html', body: Readable.from(html) },
      fields: 'id, name',
    });
    return Response.json({ success: true, file: res.data });
  } catch (err) {
    return Response.json({ error: 'Drive save failed: ' + err.message }, { status: 500 });
  }
}
