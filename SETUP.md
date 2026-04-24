# Drive Manager — Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Google account

---

## Step 1 — Google Cloud Setup (one-time)

1. Go to https://console.cloud.google.com/
2. Create a new project (e.g. "Drive Manager")
3. Enable the **Google Drive API**:
   - APIs & Services → Library → search "Google Drive API" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://your-app.vercel.app/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**

---

## Step 2 — Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local

# 3. Fill in .env.local with your values:
#    GOOGLE_CLIENT_ID=...
#    GOOGLE_CLIENT_SECRET=...
#    NEXTAUTH_SECRET=<run: openssl rand -base64 32>
#    NEXTAUTH_URL=http://localhost:3000

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 — you should see the login page.

---

## Step 3 — Deploy to Vercel (free)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Then in the Vercel dashboard → your project → Settings → Environment Variables, add:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` = `https://your-app.vercel.app`

Also add the production redirect URI to your Google OAuth credentials (Step 1, point 4).

---

## Project Structure

```
app/
├── api/
│   ├── auth/[...nextauth]/route.js   # Google OAuth + token refresh
│   └── drive/
│       ├── files/route.js            # GET: list files in a folder
│       ├── folder/route.js           # POST: create folder
│       ├── upload/route.js           # POST: upload file
│       └── delete/[id]/route.js      # DELETE: move file to trash
├── components/
│   ├── Providers.js                  # NextAuth session provider
│   ├── LoginPage.jsx                 # Sign-in screen
│   ├── DriveApp.jsx                  # Main app shell
│   ├── Toolbar.jsx                   # New folder + upload controls
│   ├── Breadcrumb.jsx                # Folder navigation
│   ├── FileList.jsx                  # Grid of files
│   └── FileItem.jsx                  # Single file/folder card
├── globals.css
├── layout.js
└── page.js
```

## Notes

- Files are moved to **Trash** when deleted (not permanently deleted)
- Upload limit is 50MB per file (configurable in `next.config.mjs`)
- Access tokens are stored server-side only — never exposed to the browser
