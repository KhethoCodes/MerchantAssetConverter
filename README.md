# MerchantAssetConverter

MerchantAssetConverter is a Next.js app that crops merchant lifestyle images
and converts them to 600 × 400 PNGs.

## Run locally

Requirements: Node.js 18 or later.

```powershell
npm install
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

No sign-in, database, hosted file storage, API keys, or external service
configuration is required. Images are processed with Sharp and returned
directly to the browser; generated previews exist only in the current page
session and are not saved.
