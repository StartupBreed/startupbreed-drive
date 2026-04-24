import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { authOptions } from '../../auth/[...nextauth]/route';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const VALID_STATUSES = ['active', 'paused', 'inactive', 'closed'];
const VALID_SENIORITIES = ['Entry', 'Mid', 'Senior', 'Management', 'Executive'];

function formatSalaryRange(min, max) {
  const minK = min ? Math.round(Number(min) / 1000) : null;
  const maxK = max ? Math.round(Number(max) / 1000) : null;
  if (minK && maxK) return `${minK}K - ${maxK}K`;
  if (minK) return `${minK}K+`;
  if (maxK) return `Up to ${maxK}K`;
  return '';
}

function parseRows(rows) {
  // Group rows by client
  const clientMap = {};
  for (const row of rows) {
    const client = String(row['Client Name'] || '').trim();
    const position = String(row['Position Name'] || '').trim();
    if (!client || !position) continue;

    const status = VALID_STATUSES.includes(String(row['Status'] || '').toLowerCase())
      ? String(row['Status']).toLowerCase() : 'active';
    const seniority = VALID_SENIORITIES.find(
      (s) => s.toLowerCase() === String(row['Seniority'] || '').toLowerCase()
    ) || '';
    const salaryMin = String(row['Salary Min'] || '').replace(/[^0-9]/g, '');
    const salaryMax = String(row['Salary Max'] || '').replace(/[^0-9]/g, '');
    const commission = String(row['Commission'] || '').replace(/[^0-9.]/g, '');

    if (!clientMap[client]) clientMap[client] = [];
    clientMap[client].push({
      name: position,
      status,
      manager: String(row['Manager'] || '').trim(),
      support: String(row['Support'] || '').trim(),
      seniority,
      location: String(row['Location'] || '').trim(),
      salaryMin,
      salaryMax,
      salaryRange: formatSalaryRange(salaryMin, salaryMax),
      commission,
    });
  }
  return clientMap;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse uploaded Excel file
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer);

  // Find the "Pipeline" sheet (or fall back to first sheet)
  const sheetName = wb.SheetNames.includes('Pipeline') ? 'Pipeline' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws);

  if (!rows.length) return Response.json({ error: 'No data found in the Pipeline sheet' }, { status: 400 });

  const importData = parseRows(rows);

  // Connect to Drive
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  const summary = { clientsCreated: 0, clientsSkipped: 0, positionsCreated: 0, positionsSkipped: 0, errors: [] };

  // Get existing clients
  const existingRes = await drive.files.list({
    q: `'${ROOT_ID}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 200,
  });
  const clientMap = Object.fromEntries(
    (existingRes.data.files || []).map((f) => [f.name.toLowerCase(), f.id])
  );

  for (const [clientName, positions] of Object.entries(importData)) {
    let clientId = clientMap[clientName.toLowerCase()];

    if (clientId) {
      summary.clientsSkipped++;
    } else {
      try {
        const res = await drive.files.create({
          requestBody: { name: clientName, mimeType: FOLDER_MIME, parents: [ROOT_ID] },
          fields: 'id',
        });
        clientId = res.data.id;
        summary.clientsCreated++;
      } catch (err) {
        summary.errors.push(`Failed to create client "${clientName}": ${err.message}`);
        continue;
      }
    }

    // Get existing positions in this client
    const posRes = await drive.files.list({
      q: `'${clientId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 200,
    });
    const existingPos = new Set((posRes.data.files || []).map((f) => f.name.toLowerCase()));

    for (const pos of positions) {
      if (existingPos.has(pos.name.toLowerCase())) {
        summary.positionsSkipped++;
        continue;
      }
      try {
        await drive.files.create({
          requestBody: {
            name: pos.name,
            mimeType: FOLDER_MIME,
            parents: [clientId],
            properties: {
              status: pos.status,
              manager: pos.manager,
              support: pos.support,
              seniority: pos.seniority,
              location: pos.location,
              salaryMin: pos.salaryMin,
              salaryMax: pos.salaryMax,
              salaryRange: pos.salaryRange,
              commission: pos.commission,
            },
          },
          fields: 'id',
        });
        summary.positionsCreated++;
      } catch (err) {
        summary.errors.push(`Failed to create "${pos.name}" in "${clientName}": ${err.message}`);
      }
    }
  }

  return Response.json(summary);
}
