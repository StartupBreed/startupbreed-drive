import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ companyName, website, linkedin, additionalNote }) {
  return `You are a professional recruitment consultant. Research the company "${companyName}" using the website and LinkedIn provided, then fill in every field of the Client Intake form.

Company Name: ${companyName}
Website: ${website || 'Not provided'}
LinkedIn: ${linkedin || 'Not provided'}
Additional Note: ${additionalNote || 'None'}

Return ONLY a valid JSON object with exactly these keys. No markdown, no explanation, just the JSON:

{
  "registeredName": "full legal name if verifiable, otherwise 'To be confirmed'",
  "registrationNumber": "To be confirmed",
  "industry": "1-3 word industry label",
  "companySize": "employee count + brief breakdown sentence",
  "currentFunding": "funding status, rounds, investors if public — or 'Bootstrapped / Not publicly disclosed'",
  "officeLocations": "all offices listed",
  "elevatorPitch": "2-3 professional sentences: what they do, who they serve, what makes them compelling",
  "mission": "one sentence mission statement",
  "vision": "one sentence vision statement",
  "companyBackground": "3-5 sentences: founding year, founders, milestones, current stage",
  "servicesProducts": ["Product/Service 1 — one sentence", "Product/Service 2 — one sentence"],
  "usp": ["Specific USP 1", "Specific USP 2", "Specific USP 3", "Specific USP 4"],
  "targetMarket": ["Primary segment 1", "Primary segment 2"],
  "mainCompetitors": "Competitor A, Competitor B, Competitor C",
  "companyCulture": "3-5 sentences about work environment, management style, team dynamics",
  "qualitiesValued": "5-7 specific employee attributes, each on its own line starting with a dash"
}`;
}

function buildHTML({ companyName, website, linkedin, date, data }) {
  const tableStyle = 'width:100%;border-collapse:collapse;margin-bottom:16px;';
  const labelStyle = 'background:#f3f3f3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:35%;vertical-align:top;';
  const valueStyle = 'padding:8px 12px;border:1px solid #ccc;vertical-align:top;';
  const h2Style = 'background:#4a4a4a;color:white;padding:8px 12px;margin:24px 0 8px 0;font-size:14px;';

  const row = (label, value) => `
    <tr>
      <td style="${labelStyle}">${label}</td>
      <td style="${valueStyle}">${value || '<span style="color:#999">To be confirmed</span>'}</td>
    </tr>`;

  const listItems = (arr) => arr.map(item => `• ${item}`).join('<br>');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:12px;margin:32px;">

<h1 style="font-size:18px;margin-bottom:4px;">Company Name: ${companyName}</h1>
<p style="margin:4px 0;">Intake by: <strong>StartupBreed</strong> &nbsp;&nbsp; Date: <strong>${date}</strong></p>

<h2 style="${h2Style}">General Information</h2>
<table style="${tableStyle}">
  ${row('Registered Name', data.registeredName)}
  ${row('Registration Number', data.registrationNumber)}
  ${row('Job Industry', data.industry)}
  ${row('Company Size<br>(number of employees)', data.companySize)}
  ${row('Current Funding', data.currentFunding)}
  ${row('Office Location(s)', data.officeLocations)}
</table>

<h2 style="${h2Style}">Company Information</h2>
<table style="${tableStyle}">
  ${row('Elevator Pitch', data.elevatorPitch)}
  ${row('Mission/Vision', `Mission: ${data.mission}<br>Vision: ${data.vision}`)}
  ${row('Company Background', data.companyBackground)}
  ${row('Services/Products', listItems(data.servicesProducts || []))}
  ${row('Unique Selling Points (USP)', listItems(data.usp || []))}
  ${row('Target Market', listItems(data.targetMarket || []))}
  ${row('Main Competitors', data.mainCompetitors)}
</table>

<h2 style="${h2Style}">Company Culture & Values</h2>
<table style="${tableStyle}">
  ${row('Company Culture', data.companyCulture)}
  ${row('Qualities valued most in employees', data.qualitiesValued)}
</table>

<h2 style="${h2Style}">Resources</h2>
<table style="${tableStyle}">
  ${row('Website', website ? `<a href="${website}">${website}</a>` : 'To be confirmed')}
  ${row('LinkedIn', linkedin ? `<a href="${linkedin}">${linkedin}</a>` : 'To be confirmed')}
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
