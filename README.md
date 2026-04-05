# TIMEPROOF Inspection Report

## Setup

1. Clone repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in all values
4. `npx prisma generate`
5. `npx prisma db push`
6. `npm run dev`

## Google Drive Setup

1. Go to Google Cloud Console
2. Create a new project
3. Enable the Google Drive API
4. Create a Service Account (IAM & Admin → Service Accounts)
5. Create a JSON key for the service account — download it
6. From the JSON: copy `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL
7. From the JSON: copy `private_key` → GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
   (keep the \n characters intact)
8. In your Google Drive: create a folder called "TIMEPROOF Inspections"
9. Share that folder with the service account email (Editor access)
10. Copy the folder ID from the URL → GOOGLE_DRIVE_PARENT_FOLDER_ID

## Vercel Deployment

1. Push to GitHub
2. Import repo in Vercel
3. Add all env vars in Vercel dashboard
4. Deploy

## Resend Setup

1. Create account at resend.com
2. Verify your sending domain or use the sandbox
3. Create API key → RESEND_API_KEY
4. Set RESEND_FROM_EMAIL to your verified address
