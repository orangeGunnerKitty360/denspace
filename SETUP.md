# DenSpace Backend Setup

DenSpace now uses:

- Neon Postgres for posts and reactions
- Neon Auth for email/password users and sessions
- Vercel Blob for image uploads

## Required Environment Variables

Add these to the Vercel project before deploying:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token"
NEON_AUTH_BASE_URL="https://ep-your-branch.neonauth.us-east-1.aws.neon.tech/neondb/auth"
NEON_AUTH_COOKIE_SECRET="replace-with-at-least-32-random-characters"
```

Generate the cookie secret with:

```bash
openssl rand -base64 32
```

## Setup Steps

1. In Neon, create a Postgres project and enable Neon Auth for the branch.
2. Copy the database connection string into `DATABASE_URL`.
3. Copy the Neon Auth endpoint into `NEON_AUTH_BASE_URL`.
4. In Vercel, create a Blob store for this project so `BLOB_READ_WRITE_TOKEN` is available.
5. Add all four environment variables to Production, Preview, and Development in Vercel.
6. Deploy with:

```bash
npx vercel --prod
```

The app creates its `posts` and `post_reactions` tables automatically on first API use.
