# StartupBreed Drive Manager

Internal tool for StartupBreed to manage Google Drive folders and auto-generate recruitment documents (Client Intake, Pre-Hunt, Job Descriptions) using AI.

---

## Getting Started

You have been added as a collaborator on this GitHub repo. No environment variables or API keys are needed — everything is already configured in Vercel.

### Prerequisites

- [Git](https://git-scm.com/)
- A code editor (e.g. [VS Code](https://code.visualstudio.com/))

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/StartupBreed/startupbreed-drive.git
cd startupbreed-drive
```

---

## Step 2 — Make Changes & Push

Edit the code, then push to GitHub:

```bash
git add .
git commit -m "your message"
git push origin main
```

Vercel will automatically detect the push and redeploy the live app — no manual deployment needed.

---

## Running Locally (Optional)

If you want to run the app on your machine before pushing:

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Create a `.env.local` file in the root folder — get the values from the team:
```
GOOGLE_CLIENT_ID=get_from_team
GOOGLE_CLIENT_SECRET=get_from_team
NEXTAUTH_SECRET=get_from_team
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=get_from_team
```

> ⚠️ Never commit `.env.local` to Git. It is already in `.gitignore`.

### 3. Add Google OAuth redirect URI
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials** → click the OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Click **Save**

### 4. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

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

To restore to the last stable tagged version:

```bash
git checkout v1-stable
```

To go back to latest:

```bash
git checkout main
```

---

## Common Issues

**Changes not showing on live site**
- Check the Vercel dashboard to make sure the latest build passed

**`npm install` fails**
- Make sure you're using Node.js v18 or higher: `node -v`

**Google sign-in not working locally**
- Make sure `http://localhost:3000/api/auth/callback/google` is added to your Google OAuth redirect URIs
