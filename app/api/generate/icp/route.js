import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { Readable } from 'stream';
import Anthropic from '@anthropic-ai/sdk';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, VerticalAlign,
} from 'docx';
import { authOptions } from '../../auth/[...nextauth]/route';

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT     = 'Poppins';
const BRAND    = '424495';
const GRAY     = '606060';
const SZ_TITLE = 30;   // 15pt
const SZ_BIO   = 16;   // 8pt
const SZ_HEAD  = 18;   // 9pt
const SZ_BODY  = 18;   // 9pt

// Landscape A4 in DXA (1 inch = 1440 DXA, 1 cm ≈ 567 DXA)
const PAGE_W   = 16838;   // 29.7 cm
const PAGE_H   = 11906;   // 21.0 cm
const MARGIN   = 720;     // ~1.27 cm
const USABLE_W = PAGE_W - MARGIN * 2;
const GAP_W    = 360;
const COL_W    = Math.floor((USABLE_W - GAP_W) / 2);

// ── Helpers ───────────────────────────────────────────────────────────────────
function r(text, { bold = false, size = SZ_BODY, color = '000000' } = {}) {
  return new TextRun({ text, bold, size, color, font: FONT });
}

function sectionHeader(text, spaceBefore = 120) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: spaceBefore, after: 30, line: 220, lineRule: 'auto' },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 } },
    children: [r(text, { bold: true, size: SZ_HEAD })],
  });
}

function labelBullet(label, value) {
  if (!value) return null;
  return new Paragraph({
    spacing: { before: 0, after: 20, line: 220, lineRule: 'auto' },
    indent: { left: 360, hanging: 180 },
    children: [
      r('- '),
      r(`${label}: `, { bold: true }),
      r(value),
    ],
  });
}

function bullet(text) {
  if (!text) return null;
  return new Paragraph({
    spacing: { before: 0, after: 20, line: 220, lineRule: 'auto' },
    indent: { left: 360, hanging: 180 },
    children: [r(`- ${text}`)],
  });
}

const NO_BORDER    = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const TABLE_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

function cell(paragraphs, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    borders: CELL_BORDERS,
    children: paragraphs.filter(Boolean),
  });
}

// ── Document builder ──────────────────────────────────────────────────────────
function buildICPDocx(d, positionName, companyName) {
  // Subtitle: Company · Seniority
  const subtitleParts = [companyName, d.seniority].filter(Boolean);

  // Biography strip
  const bioFields = [
    ['Age Range',   d.age_range],
    ['Salary',      d.salary_range],
    ['Location',    d.location],
    ['Nationality', d.nationality],
    ['Education',   d.education],
  ].filter(([, v]) => v);

  const bioRuns = [];
  bioFields.forEach(([label, val], i) => {
    if (i > 0) bioRuns.push(r('  ·  ', { size: SZ_BIO, color: GRAY }));
    bioRuns.push(r(`${label}: `, { bold: true, size: SZ_BIO, color: GRAY }));
    bioRuns.push(r(val, { size: SZ_BIO, color: GRAY }));
  });

  // Left column
  const leftChildren = [
    sectionHeader('PROFESSIONAL SUMMARY', 0),
    ...(d.professional_summary || []).map(bullet),
    sectionHeader('TARGET BACKGROUND'),
    labelBullet('Experience', d.experience),
    d.industries?.length     ? labelBullet('Industries',    d.industries.join(', '))     : null,
    d.previous_roles?.length ? labelBullet('Target Roles',  d.previous_roles.join(', ')) : null,
    sectionHeader('SKILLS'),
    d.must_have?.length      ? labelBullet('Must-have',    d.must_have.join(', '))    : null,
    d.nice_to_have?.length   ? labelBullet('Nice-to-have', d.nice_to_have.join(', ')) : null,
  ];

  // Right column
  const rightChildren = [
    sectionHeader('CULTURE & PERSONALITY', 0),
    ...(d.culture_personality || []).map(bullet),
    sectionHeader('MOTIVATIONS & GOALS'),
    ...(d.motivations || []).map(bullet),
  ];

  const bodyTable = new Table({
    width: { size: USABLE_W, type: WidthType.DXA },
    borders: TABLE_BORDERS,
    rows: [new TableRow({
      children: [
        cell(leftChildren,                                  COL_W),
        cell([new Paragraph({ children: [r('')] })],        GAP_W),
        cell(rightChildren,                                 COL_W),
      ],
    })],
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: 'landscape' },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 20, line: 240, lineRule: 'auto' },
          children: [r(positionName.toUpperCase(), { bold: true, size: SZ_TITLE, color: BRAND })],
        }),
        // Subtitle
        ...(subtitleParts.length ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
          children: [r(subtitleParts.join('  ·  '), { size: SZ_BODY, color: GRAY })],
        })] : []),
        // Biography strip
        ...(bioRuns.length ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 80, line: 220, lineRule: 'auto' },
          children: bioRuns,
        })] : []),
        // 2-column body
        bodyTable,
      ],
    }],
  });
}

// ── Claude prompt ─────────────────────────────────────────────────────────────
function buildPrompt(positionName, companyName, intakeText, prehuntText, jdText, additionalNote) {
  return `You are a senior recruitment consultant at StartupBreed, a headhunting firm.
Read the finalized recruitment documents below and return a JSON object describing the Ideal Candidate Persona (ICP) for this role.
The ICP is a client-facing document — keep all content professional, concise, and actionable.

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
  "seniority":            "e.g. Senior",
  "age_range":            "e.g. 27-35",
  "salary_range":         "e.g. 80,000-120,000 THB/month",
  "location":             "e.g. Bangkok, Thailand",
  "nationality":          "e.g. Thai or any",
  "education":            "e.g. Bachelor's degree or above",
  "professional_summary": ["sentence 1", "sentence 2", "sentence 3"],
  "experience":           "e.g. 5+ years in B2B SaaS product management",
  "industries":           ["Industry A", "Industry B", "Industry C"],
  "previous_roles":       ["Role A", "Role B", "Role C"],
  "must_have":            ["Skill A", "Skill B", "Skill C", "Skill D", "Skill E"],
  "nice_to_have":         ["Skill E", "Skill F"],
  "culture_personality":  ["Trait A", "Trait B", "Trait C", "Trait D"],
  "motivations":          ["Motivation A", "Motivation B", "Motivation C"]
}

Rules (all values must be concise — this fits on 1 page):
- professional_summary: max 3 items, full sentences describing who this person is overall
- industries: max 3 items
- previous_roles: max 3 items, short role titles only
- must_have: max 5 items, short skill phrases
- nice_to_have: max 3 items, short skill phrases
- culture_personality: max 4 items, short descriptive phrases about how they work and who they are
- motivations: max 3 items, concise sentences about what drives them and what they seek`;
}

// ── API Route ─────────────────────────────────────────────────────────────────
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
    return (res.data.files || []).find(f => f.properties?.documentType === docType) || null;
  }

  try {
    // Fetch source docs in parallel
    const [intakeFile, prehuntFile, jdFile] = await Promise.all([
      findDocByType(clientFolderId, 'intake'),
      findDocByType(positionFolderId, 'prehunt'),
      findDocByType(positionFolderId, 'jd'),
    ]);
    const [intakeText, prehuntText, jdText] = await Promise.all([
      intakeFile  ? exportDocText(intakeFile.id)  : null,
      prehuntFile ? exportDocText(prehuntFile.id) : null,
      jdFile      ? exportDocText(jdFile.id)      : null,
    ]);

    // Ask Claude for structured ICP JSON
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(positionName, companyName, intakeText, prehuntText, jdText, additionalNote) }],
    });

    // Parse JSON
    let icpData;
    try {
      const raw = message.content[0].text.trim();
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      icpData = JSON.parse(jsonStr);
    } catch {
      return Response.json({ error: 'Claude returned invalid JSON. Please try again.' }, { status: 500 });
    }

    // Build .docx
    const doc = buildICPDocx(icpData, positionName, companyName);
    const buffer = await Packer.toBuffer(doc);

    // Upload to Drive as .docx (preserves landscape orientation)
    const created = await drive.files.create({
      requestBody: {
        name: `ICP - ${positionName}`,
        parents: [positionFolderId],
        properties: { documentType: 'icp' },
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: Readable.from(buffer),
      },
      fields: 'id, name, mimeType, properties',
    });

    return Response.json({ file: created.data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
