import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

const SPREADSHEET_ID = process.env.SHEETS_KPI_ID;
const RANGE = 'Recruiter Table!A2:B';

function getSheets(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

// GET — return all recruiters
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sheets = getSheets(session.access_token);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const recruiters = rows
      .filter(r => r[0])
      .map(r => ({ name: r[0], email: r[1] || '' }));
    return Response.json({ recruiters });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST — add a new recruiter
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email } = await request.json();
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const sheets = getSheets(session.access_token);
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Recruiter Table!A:B',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[name, email || '']] },
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — clear the row for a recruiter (preserves row references, does not shift data)
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const sheets = getSheets(session.access_token);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex(r => r[0]?.toLowerCase() === name.toLowerCase());
    if (rowIdx === -1) {
      return Response.json({ error: 'Recruiter not found' }, { status: 404 });
    }

    const sheetRow = rowIdx + 2;
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `Recruiter Table!A${sheetRow}:B${sheetRow}`,
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
