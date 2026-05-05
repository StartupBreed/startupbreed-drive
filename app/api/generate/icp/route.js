import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { Readable } from 'stream';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { positionFolderId, clientFolderId, positionName, companyName, additionalNote } = await request.json();

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  // Export a Google Doc as plain text
  async function exportDocText(fileId) {
    try {
      const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch {
      return null;
    }
  }

  // Find a file by documentType property within a folder
  async function findDocByType(folderId, docType) {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, properties)',
      pageSize: 50,
    });
    return (res.data.files || []).find((f) => f.properties?.documentType === docType) || null;
  }

  try {
    // Fetch source document files
    const [intakeFile, prehuntFile, jdFile] = await Promise.all([
      findDocByType(clientFolderId, 'intake'),
      findDocByType(positionFolderId, 'prehunt'),
      findDocByType(positionFolderId, 'jd'),
    ]);

    // Export content in parallel
    const [intakeText, prehuntText, jdText] = await Promise.all([
      intakeFile ? exportDocText(intakeFile.id) : null,
      prehuntFile ? exportDocText(prehuntFile.id) : null,
      jdFile ? exportDocText(jdFile.id) : null,
    ]);

    const prompt = `You are a senior recruitment consultant at StartupBreed, a headhunting firm.
Based on the finalized recruitment documents below, generate a comprehensive Ideal Candidate Persona (ICP) for this role.

POSITION: ${positionName}
COMPANY: ${companyName}

--- CLIENT INTAKE ---
${intakeText || '(not available)'}

--- PRE-HUNT DOCUMENT ---
${prehuntText || '(not available)'}

--- JOB DESCRIPTION ---
${jdText || '(not available)'}
${additionalNote ? `\nADDITIONAL NOTES FROM RECRUITER:\n${additionalNote}` : ''}

Generate the ICP with these 7 sections. Use clear headings and bullet points within each section:

1. Professional Background
   - Years and type of experience required
   - Industries and company types (startup, corporate, etc.)
   - Previous role types and titles to target

2. Technical & Domain Skills
   - Must-have skills
   - Nice-to-have skills

3. Soft Skills & Personality Traits
   - Key behavioral traits
   - Working style and communication preferences

4. Motivations & Career Goals
   - What would attract this person to the role
   - What they are looking for in their next move

5. Cultural Fit Indicators
   - Team and management style they thrive under
   - Company stage and environment preferences

6. Red Flags / Disqualifiers
   - Backgrounds or traits that suggest poor fit
   - What would make them decline an offer

7. Sourcing Keywords & Search Strategy
   - LinkedIn boolean search strings
   - Target companies to source from
   - Communities, events, or platforms to find this profile

Be specific, practical, and actionable throughout.`;

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const icpText = message.content[0].text;

    // Create Google Doc in position folder (upload text → auto-convert)
    const stream = Readable.from(Buffer.from(icpText, 'utf-8'));
    const created = await drive.files.create({
      requestBody: {
        name: `ICP - ${positionName}`,
        parents: [positionFolderId],
        mimeType: 'application/vnd.google-apps.document',
        properties: { documentType: 'icp' },
      },
      media: {
        mimeType: 'text/plain',
        body: stream,
      },
      fields: 'id, name, mimeType, properties',
    });

    return Response.json({ file: created.data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
