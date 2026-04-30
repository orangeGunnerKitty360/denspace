# DenSpace

DenSpace is a Frutiger Aero social feed with email/password authentication, shared posts, reactions, and image uploads.

## Stack

- Next.js
- Neon Auth
- Neon Postgres
- Vercel Blob
- Vercel hosting

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file:

```bash
cp .env.example .env.local
```

3. Fill in:

```bash
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
```

4. Start the app:

```bash
npm run dev
```

The Postgres tables are created automatically the first time the posts API runs.
