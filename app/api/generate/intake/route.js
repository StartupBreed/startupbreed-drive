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
  const font = 'font-family:Arial,sans-serif;';
  const tableStyle = `width:100%;border-collapse:collapse;margin-bottom:8px;${font}font-size:11pt;`;
  const labelStyle = 'padding:12px 14px;border:1px solid #d0d0d0;width:30%;vertical-align:top;color:#333;';
  const valueStyle = 'padding:12px 14px;border:1px solid #d0d0d0;vertical-align:top;color:#111;';
  const h2Style = `color:#D4622A;font-weight:bold;font-size:12pt;margin:28px 0 4px 0;padding-bottom:4px;border-bottom:1.5px solid #e0e0e0;${font}`;
  const divider = '<hr style="border:none;border-top:1px solid #e0e0e0;margin:6px 0 14px 0;">';

  const row = (label, value) => `
    <tr>
      <td style="${labelStyle}">${label}</td>
      <td style="${valueStyle}">${value || '<span style="color:#aaa">—</span>'}</td>
    </tr>`;

  const bullets = (arr) => (arr || []).map(item => `• &nbsp;${item}`).join('<br>');

  return `<!DOCTYPE html><html><body style="${font}font-size:11pt;margin:40px 48px;color:#111;">

<h1 style="font-size:20pt;font-weight:bold;color:#2D2B6B;margin-bottom:6px;${font}">Company Name: ${companyName}</h1>
${divider}
<p style="margin:6px 0;font-size:11pt;">Intake by: &nbsp;${data.intakeBy || 'StartupBreed'}</p>
<p style="margin:6px 0 20px 0;font-size:11pt;">Date: &nbsp;${date}</p>
${divider}

<h2 style="${h2Style}">General Information</h2>
${divider}
<table style="${tableStyle}">
  ${row('Registered Name', data.registeredName)}
  ${row('Registration Number', data.registrationNumber)}
  ${row('Job Industry', data.industry)}
  ${row('Company Size<br>(number of employees)', data.companySize)}
  ${row('Current Funding', data.currentFunding)}
  ${row('Office Location(s)', data.officeLocations)}
</table>

<h2 style="${h2Style}">Company Information</h2>
${divider}
<table style="${tableStyle}">
  ${row('Elevator Pitch', data.elevatorPitch)}
  ${row('Mission/Vision', `<strong>Mission:</strong> ${data.mission}<br><br><strong>Vision:</strong> ${data.vision}`)}
  ${row('Company Background', data.companyBackground)}
  ${row('Services/Products', bullets(data.servicesProducts))}
  ${row('Unique Selling Points (USP)', bullets(data.usp))}
  ${row('Target Market', bullets(data.targetMarket))}
  ${row('Main Competitors', bullets((data.mainCompetitors || '').split(',').map(s => s.trim())))}
</table>

<h2 style="${h2Style}">Company Culture &amp; Values</h2>
${divider}
<table style="${tableStyle}">
  ${row('Company Culture', data.companyCulture)}
  ${row('Qualities valued most in your employees (Optional)', data.qualitiesValued)}
</table>

<h2 style="${h2Style}">Resources (hyperlink)</h2>
${divider}
<table style="${tableStyle}">
  ${row('Website', website ? `<a href="${website}" style="color:#1155CC;">${website}</a>` : '<span style="color:#aaa">—</span>')}
  ${row('LinkedIn', linkedin ? `<a href="${linkedin}" style="color:#1155CC;">${linkedin}</a>` : '<span style="color:#aaa">—</span>')}
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
