import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { Readable } from 'stream';
import Anthropic from '@anthropic-ai/sdk';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, Header, PageOrientation,
} from 'docx';
import { authOptions } from '../../auth/[...nextauth]/route';

// ── Styling constants (mirrors resume-template) ──────────────────────────────
const FONT  = 'Poppins';
const SZ_LG = 32;   // 16pt — position title first letter
const SZ_MD = 28;   // 14pt — position title rest
const SZ_SM = 18;   // 9pt  — body text

function titleRuns(text) {
  const runs = [];
  text.toUpperCase().split(' ').forEach((word, i) => {
    if (i > 0) runs.push(new TextRun({ text: ' ', size: SZ_MD, font: FONT, bold: true }));
    runs.push(new TextRun({ text: word[0], size: SZ_LG, font: FONT, bold: true }));
    if (word.length > 1)
      runs.push(new TextRun({ text: word.slice(1), size: SZ_MD, font: FONT, bold: true }));
  });
  return runs;
}

function sectionHeader(text, beforePt = 60) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: beforePt, after: 30 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 } },
    children: [new TextRun({ text, bold: true, font: FONT })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { line: 228, lineRule: 'auto' },
    children: [new TextRun({ text, size: SZ_SM, font: FONT })],
  });
}

function labelBullet(label, value) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { line: 228, lineRule: 'auto' },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: SZ_SM, font: FONT }),
      new TextRun({ text: value, size: SZ_SM, font: FONT }),
    ],
  });
}

function buildICPDocx(d, positionName, companyName, seniority, location) {
  const subtitle = [companyName, seniority, location].filter(Boolean).join('  ·  ');

  return new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '-',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 180 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720, header: 227, footer: 397 },
        },
        column: { count: 2, space: 720, equalWidth: true },
        titlePage: true,
      },
      headers: {
        first: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 20, line: 276, lineRule: 'auto' },
              children: titleRuns(positionName),
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [new TextRun({ text: subtitle, size: SZ_SM, font: FONT })],
            }),
          ],
        }),
      },
      children: [

        // ── PROFESSIONAL BACKGROUND ──────────────────────────────────────────
        sectionHeader('PROFESSIONAL BACKGROUND', 100),
        labelBullet('Experience', d.background.experience),
        labelBullet('Industries', d.background.industries.join(', ')),
        labelBullet('Target Roles', d.background.previousRoles.join(', ')),

        // ── TECHNICAL SKILLS ─────────────────────────────────────────────────
        sectionHeader('TECHNICAL SKILLS'),
        labelBullet('Must-have', d.technicalSkills.mustHave.join(', ')),
        labelBullet('Nice-to-have', d.technicalSkills.niceToHave.join(', ')),

        // ── SOFT SKILLS & PERSONALITY ────────────────────────────────────────
        sectionHeader('SOFT SKILLS & PERSONALITY'),
        ...d.softSkills.map(bullet),

        // ── COLUMN BREAK → right column starts here ──────────────────────────
        new Paragraph({
          children: [new TextRun({ break: 'column' })],
        }),

        // ── MOTIVATIONS & CAREER GOALS ───────────────────────────────────────
        sectionHeader('MOTIVATIONS & CAREER GOALS', 0),
        ...d.motivations.map(bullet),

        // ── CULTURAL FIT & RED FLAGS ─────────────────────────────────────────
        sectionHeader('CULTURAL FIT & RED FLAGS'),
        labelBullet('Fit indicators', d.culturalFit.join(', ')),
        labelBullet('Disqualifiers', d.redFlags.join(', ')),

        // ── SOURCING STRATEGY ────────────────────────────────────────────────
        sectionHeader('SOURCING STRATEGY'),
        labelBullet('Boolean', d.sourcing.boolean),
        labelBullet('Target companies', d.sourcing.targetCompanies.join(', ')),
        labelBullet('Platforms', d.sourcing.platforms.join(', ')),
      ],
    }],
  });
}

// ── API Route ────────────────────────────────────────────────────────────────

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { positionFolderId, clientFolderId, positionName, companyName, additionalNote } = await request.json();

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  async function exportDocText(fileId) {
    try {
      const res = await drive.files.export(
        { fileId, mimeType: 'text/plain' },
        { responseType: 'text' },
      );
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch { return null; }
  }

  async function findDocByType(folderId, docType) {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, properties)',
      pageSize: 50,
    });
    return (res.data.files || []).find((f) => f.properties?.documentType === docType) || null;
  }

  try {
    // Fetch source docs in parallel
    const [intakeFile, prehuntFile, jdFile] = await Promise.all([
      findDocByType(clientFolderId, 'intake'),
      findDocByType(positionFolderId, 'prehunt'),
      findDocByType(positionFolderId, 'jd'),
    ]);
    const [intakeText, prehuntText, jdText] = await Promise.all([
      intakeFile ? exportDocText(intakeFile.id) : null,
      prehuntFile ? exportDocText(prehuntFile.id) : null,
      jdFile ? exportDocText(jdFile.id) : null,
    ]);

    // Ask Claude to produce structured JSON
    const prompt = `You are a senior recruitment consultant at StartupBreed, a headhunting firm.
Read the finalized recruitment documents below and return a JSON object describing the Ideal Candidate Persona (ICP) for this role.

POSITION: ${positionName}
COMPANY: ${companyName}

--- CLIENT INTAKE ---
${intakeText || '(not available)'}

--- PRE-HUNT DOCUMENT ---
${prehuntText || '(not available)'}

--- JOB DESCRIPTION ---
${jdText || '(not available)'}
${additionalNote ? `\nADDITIONAL NOTES:\n${additionalNote}` : ''}

Return ONLY a valid JSON object (no markdown, no explanation) matching this schema exactly:
{
  "seniority": "e.g. Senior / Mid / Manager",
  "location": "e.g. Bangkok, Thailand",
  "background": {
    "experience": "e.g. 5+ years in B2B SaaS sales",
    "industries": ["Industry A", "Industry B"],
    "previousRoles": ["Role A", "Role B", "Role C"]
  },
  "technicalSkills": {
    "mustHave": ["Skill A", "Skill B", "Skill C", "Skill D"],
    "niceToHave": ["Skill E", "Skill F"]
  },
  "softSkills": ["Trait A", "Trait B", "Trait C", "Trait D"],
  "motivations": ["Motivation A", "Motivation B", "Motivation C"],
  "culturalFit": ["Indicator A", "Indicator B", "Indicator C"],
  "redFlags": ["Flag A", "Flag B", "Flag C"],
  "sourcing": {
    "boolean": "LinkedIn boolean search string",
    "targetCompanies": ["Company A", "Company B", "Company C"],
    "platforms": ["LinkedIn", "Platform B"]
  }
}

Rules:
- industries: max 3 items
- previousRoles: max 3 items
- mustHave: max 5 items, short phrases only
- niceToHave: max 3 items, short phrases only
- softSkills: max 4 items, short phrases
- motivations: max 3 items, concise sentences
- culturalFit: max 3 items, short phrases
- redFlags: max 3 items, short phrases
- targetCompanies: max 4 items
- platforms: max 3 items
All values must be concise to fit a 1-page document.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse JSON from Claude response
    let icpData;
    try {
      const raw = message.content[0].text.trim();
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      icpData = JSON.parse(jsonStr);
    } catch {
      return Response.json({ error: 'Claude returned invalid JSON. Please try again.' }, { status: 500 });
    }

    // Build formatted .docx
    const doc = buildICPDocx(icpData, positionName, companyName, icpData.seniority, icpData.location);
    const buffer = await Packer.toBuffer(doc);
    const stream = Readable.from(buffer);

    // Upload as .docx (no conversion — preserves landscape orientation & columns)
    const created = await drive.files.create({
      requestBody: {
        name: `ICP - ${positionName}`,
        parents: [positionFolderId],
        properties: { documentType: 'icp' },
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: stream,
      },
      fields: 'id, name, mimeType, properties',
    });

    return Response.json({ file: created.data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
