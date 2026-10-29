# MerchantAssetConverter

MerchantAssetConverter is a Next.js web app for preparing merchant lifestyle
images as 600 × 400 PNGs. Visitors can open the portal and use it without
creating an account or signing in. Image conversions are processed with Sharp,
stored in Cloudinary, and listed in shared Supabase activity history.

## Requirements

- Node.js 18 or later
- A Supabase project
- A Cloudinary account

## Configuration

Copy `.env.local.example` to `.env.local` and provide the following values:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; server-side only |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret; server-side only |

Keep `.env.local` and all service credentials private. Never commit them.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Public access

Firebase authentication has been removed. The page, image-processing endpoint,
and shared activity history are accessible to anyone who can reach the app.
Public visitors can consume your Cloudinary storage and Supabase service
quotas, and the activity history is visible to them. Configure provider quotas
and usage alerts before deploying publicly. The Supabase service-role key stays
on the server and must never be exposed in client code.
