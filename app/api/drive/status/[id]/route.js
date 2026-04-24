import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../../auth/[...nextauth]/route';

const VALID = ['active', 'paused', 'inactive'];

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await request.json();
  if (!VALID.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.update({
      fileId: params.id,
      requestBody: { properties: { status } },
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
