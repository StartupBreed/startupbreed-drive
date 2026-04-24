import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Moves to trash instead of permanently deleting — safer UX
    await drive.files.update({
      fileId: id,
      requestBody: { trashed: true },
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
