# StartupBreed Drive Manager

Internal tool for StartupBreed to manage Google Drive folders and auto-generate recruitment documents (Client Intake, Pre-Hunt, Job Descriptions) using AI.

---

## Prerequisites

Make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)
- A Google account with access to the StartupBreed Google Drive

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/StartupBreed/startupbreed-drive.git
cd startupbreed-drive
```

---

## Step 2 — Install Dependencies

```bash
npm install
```

---

## Step 3 — Set Up Environment Variables

Create a file called `.env.local` in the root of the project folder (same level as `package.json`).

```
GOOGLE_CLIENT_ID=get_from_team
GOOGLE_CLIENT_SECRET=get_from_team
NEXTAUTH_SECRET=get_from_team
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=get_from_team
```

> ⚠️ Never commit `.env.local` to Git. It is already listed in `.gitignore`.

Get the actual values from the team. For local development, keep `NEXTAUTH_URL` as `http://localhost:3000`.

---

## Step 4 — Set Up Google OAuth Redirect URI

You need to add your local URL to the Google Cloud Console so Google login works.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Click on the OAuth 2.0 Client ID used for this project
4. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Click **Save**

---

## Step 5 — Run the App

```bash
npm run dev
```

Open your browser and go to: [http://localhost:3000](http://localhost:3000)

Sign in with your Google account to get started.

---

## Project Structure

```
app/
├── api/
│   ├── auth/          # Google OAuth (NextAuth)
│   ├── drive/         # Google Drive API routes
│   └── generate/
│       ├── intake/    # Client Intake document generation
│       └── position/  # Pre-Hunt & Job Description generation
├── components/        # UI components
└── page.js            # Main app page
```

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Auth:** NextAuth.js with Google OAuth
- **Storage:** Google Drive API
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Styling:** Tailwind CSS

---

## Restoring a Previous Version

The codebase is version-tagged. To restore to the last stable version:

```bash
git checkout v1-stable
```

To go back to the latest version:

```bash
git checkout main
```

---

## Common Issues

**Google sign-in not working**
- Make sure `http://localhost:3000/api/auth/callback/google` is added to your Google OAuth redirect URIs (Step 4)

**Environment variables not loading**
- Make sure the file is named exactly `.env.local` (with the dot) and is in the root folder

**`npm install` fails**
- Make sure you're using Node.js v18 or higher: `node -v`
