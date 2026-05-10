import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

const SPREADSHEET_ID = process.env.SHEETS_KPI_ID;
const RANGE = 'KPIs Setting!A2:B';

function getSheets(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

// GET — return KPI targets { presented, interviewed, offers }
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

    // Defaults in case sheet is empty or rows are missing
    const targets = { presented: 10, interviewed: 5, offers: 2 };
    rows.forEach(r => {
      const key = r[0]?.toLowerCase().trim();
      const val = Number(r[1]);
      if (!isNaN(val)) {
        if (key === 'presented')  targets.presented  = val;
        if (key === 'interviewed') targets.interviewed = val;
        if (key === 'offers')     targets.offers      = val;
      }
    });

    return Response.json({ targets });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
