import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId') || 'root';

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, parents, properties)',
      orderBy: 'folder,name',
      pageSize: 200,
    });
    return Response.json({ files: res.data.files });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
