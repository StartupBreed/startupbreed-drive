import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, parentId = 'root' } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Folder name required' }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.create({
      requestBody: {
        name: name.trim(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name, mimeType',
    });
    return Response.json({ file: res.data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
