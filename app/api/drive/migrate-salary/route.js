import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function formatSalaryRange(min, max) {
  const minK = min ? Math.round(Number(min) / 1000) : null;
  const maxK = max ? Math.round(Number(max) / 1000) : null;
  if (minK && maxK) return `${minK}K - ${maxK}K`;
  if (minK) return `${minK}K+`;
  if (maxK) return `Up to ${maxK}K`;
  return '';
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  let updated = 0;
  let skipped = 0;

  // Get all clients
  const clientRes = await drive.files.list({
    q: `'${ROOT_ID}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 200,
  });

  for (const client of clientRes.data.files || []) {
    // Get all positions in this client
    const posRes = await drive.files.list({
      q: `'${client.id}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id, properties)',
      pageSize: 200,
    });

    for (const pos of posRes.data.files || []) {
      const p = pos.properties || {};
      const newRange = formatSalaryRange(p.salaryMin, p.salaryMax);

      // Skip if already correct or no salary data
      if (!newRange || newRange === p.salaryRange) { skipped++; continue; }

      await drive.files.update({
        fileId: pos.id,
        requestBody: { properties: { ...p, salaryRange: newRange } },
      });
      updated++;
    }
  }

  return Response.json({ updated, skipped });
}
