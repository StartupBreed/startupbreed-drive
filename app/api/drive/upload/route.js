import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  const parentId = formData.get('parentId') || 'root';
  const documentType = formData.get('documentType') || null; // "intake" | "prehunt" | "jd" | null

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.access_token });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || file.name?.endsWith('.docx');

    const res = await drive.files.create({
      requestBody: {
        name: isDocx ? file.name.replace(/\.docx$/i, '') : file.name,
        parents: [parentId],
        ...(isDocx && { mimeType: 'application/vnd.google-apps.document' }),
        ...(documentType && { properties: { documentType } }),
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, name, mimeType, size',
    });
    return Response.json({ file: res.data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

