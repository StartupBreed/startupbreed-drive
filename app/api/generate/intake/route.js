import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildIntakePrompt({ companyName, website, linkedin, additionalNote }) {
  return `Generate a professional Client Intake document for a recruitment firm's use.

Company Name: ${companyName}
Website: ${website || 'Not provided'}
LinkedIn: ${linkedin || 'Not provided'}
Additional Note: ${additionalNote || 'None'}

Research the company using the website/LinkedIn provided and generate the full Client Intake document below. Never leave placeholders unfilled — use real researched content. Use "[To be confirmed]" ONLY for Registration Number and PoC contact details which require direct client input.

Return ONLY the plain text document, no JSON, no markdown code blocks.

---

CLIENT INTAKE DOCUMENT

Company Name: ${companyName}
Intake by: StartupBreed
Date: ${new Date().toLocaleDateString('en-GB')}

GENERAL INFORMATION
Registered Name: [full legal name if verifiable, otherwise "To be confirmed"]
Registration Number: [To be confirmed]
Industry: [1–3 word industry label]
Company Size: [employee count + brief breakdown sentence]
Current Funding: [funding status, recent rounds, amounts, key investors if public — or "Bootstrapped / Not publicly disclosed"]
Office Location(s): [all offices — headquarters + regional]

COMPANY INFORMATION
Elevator Pitch: [2–3 professional sentences: what the company does, who it serves, what makes it compelling to a candidate]
Mission: [one sentence using company's own language where available]
Vision: [one sentence using company's own language where available]
Company Background: [3–5 sentences covering founding year, founders, key milestones, current growth stage]
Services/Products:
[Product/Service 1] — [one-sentence description]
[Product/Service 2] — [one-sentence description]
[Continue up to 6 total]
Unique Selling Points:
- [Specific, concrete USP — not generic filler]
- [Specific, concrete USP]
- [Specific, concrete USP]
- [Specific, concrete USP]
[Up to 6 total, each meaningfully distinct]
Target Market: [primary customer segments — who buys from them]
Main Competitors: [3–6 direct competitors by name, comma-separated]

COMPANY CULTURE & VALUES
Company Culture: [3–5 sentences describing work environment, management style, team dynamics, pace — be honest and specific, no corporate filler]
Qualities Valued in Employees:
- [Specific, concrete attribute — e.g. "Ownership mentality — takes problems from identification to resolution"]
- [Specific attribute]
- [Specific attribute]
- [Specific attribute]
- [Specific attribute]
[5–7 total, avoid generic traits like "hardworking"]

RESOURCES
Website: ${website || '[To be confirmed]'}
LinkedIn: ${linkedin || '[To be confirmed]'}`;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyName, website, linkedin, additionalNote, folderId } = body;

  if (!companyName || !folderId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let content;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: 'You are an expert recruitment consultant at a professional headhunting firm in Bangkok. Generate detailed, professional Client Intake documents. Return plain text only — no JSON, no markdown code blocks.',
      messages: [{ role: 'user', content: buildIntakePrompt(body) }],
    });
    content = message.content[0].text.trim();
  } catch (err) {
    return Response.json({ error: 'Generation failed: ' + err.message }, { status: 500 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const fileName = `Client Intake_ ${companyName}.txt`;
    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId], mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: Readable.from(content) },
      fields: 'id, name',
    });
    return Response.json({ success: true, file: res.data });
  } catch (err) {
    return Response.json({ error: 'Drive save failed: ' + err.message }, { status: 500 });
  }
}
