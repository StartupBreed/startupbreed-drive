import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { documentType } = await request.json(); // null or "intake" | "prehunt" | "jd"

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.update({
      fileId: params.id,
      requestBody: {
        properties: documentType ? { documentType } : {},
      },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
