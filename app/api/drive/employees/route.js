import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';
const FILE_NAME = '__employees_data__';

async function getOrCreateFile(drive) {
  const search = await drive.files.list({
    q: `name = '${FILE_NAME}' and '${ROOT_ID}' in parents and trashed = false`,
    fields: 'files(id)',
  });

  if (search.data.files.length > 0) return search.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name: FILE_NAME,
      parents: [ROOT_ID],
      mimeType: 'application/json',
    },
    media: { mimeType: 'application/json', body: Readable.from('[]') },
    fields: 'id',
  });
  return created.data.id;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const fileId = await getOrCreateFile(drive);
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
    const employees = JSON.parse(res.data || '[]');
    return Response.json({ employees });
  } catch {
    return Response.json({ employees: [] });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { employees } = await request.json();

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const fileId = await getOrCreateFile(drive);
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: Readable.from(JSON.stringify(employees)) },
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
