import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

const SPREADSHEET_ID = process.env.SHEETS_KPI_ID;
const RANGE = 'Data Table!A2:F';

function getSheets(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

function rowToEntry(row, index) {
  return {
    rowIndex: index + 2, // 1-indexed, +1 for header, +1 for 0-index
    recruiterName: row[0] || '',
    presented:     row[1] !== undefined ? Number(row[1]) : null,
    interviewed:   row[2] !== undefined ? Number(row[2]) : null,
    offers:        row[3] !== undefined ? Number(row[3]) : null,
    weekEnding:    row[4] || '',
    impediment:    row[5] || '',
  };
}

// GET — return all entries
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
    const entries = rows
      .map((row, i) => rowToEntry(row, i))
      .filter(e => e.recruiterName); // skip blank rows
    return Response.json({ entries });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST — append new entry (duplicate check: recruiterName + weekEnding)
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { recruiterName, presented, interviewed, offers, weekEnding, impediment } = await request.json();
  if (!recruiterName || !weekEnding) {
    return Response.json({ error: 'recruiterName and weekEnding are required' }, { status: 400 });
  }

  const sheets = getSheets(session.access_token);
  try {
    // Check for duplicate
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = existing.data.values || [];
    const dup = rows.find(
      r => r[0]?.toLowerCase() === recruiterName.toLowerCase() &&
           r[4]?.toLowerCase() === weekEnding.toLowerCase()
    );
    if (dup) {
      return Response.json({ error: 'Entry already exists for this recruiter and week. Use PUT to update.' }, { status: 409 });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data Table!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[recruiterName, presented ?? '', interviewed ?? '', offers ?? '', weekEnding, impediment ?? '']],
      },
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PUT — update existing entry in place
export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { recruiterName, presented, interviewed, offers, weekEnding, impediment } = await request.json();
  if (!recruiterName || !weekEnding) {
    return Response.json({ error: 'recruiterName and weekEnding are required' }, { status: 400 });
  }

  const sheets = getSheets(session.access_token);
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = existing.data.values || [];
    const rowIdx = rows.findIndex(
      r => r[0]?.toLowerCase() === recruiterName.toLowerCase() &&
           r[4]?.toLowerCase() === weekEnding.toLowerCase()
    );
    if (rowIdx === -1) {
      return Response.json({ error: 'Entry not found for this recruiter and week.' }, { status: 404 });
    }

    const sheetRow = rowIdx + 2; // 1-indexed + header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Data Table!A${sheetRow}:F${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[recruiterName, presented ?? '', interviewed ?? '', offers ?? '', weekEnding, impediment ?? '']],
      },
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
