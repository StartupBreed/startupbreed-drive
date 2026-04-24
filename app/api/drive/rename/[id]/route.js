import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.update({
      fileId: params.id,
      requestBody: { name: name.trim() },
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
