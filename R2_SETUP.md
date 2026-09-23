# Cloudflare R2 Image & Media Storage Setup Guide

NightOS uses **Cloudflare R2** for fast, cost-effective object storage to host high-resolution product photos, venue logos, and menu media without egress fees.

---

## 🏗️ Architecture Overview

```
┌────────────────────────┐      1. Request Presigned URL       ┌────────────────────────┐
│  Manager Web Portal    │ ─────────────────────────────────> │  Supabase Edge Func    │
│  (Client-side canvas)  │                                    │ `generate-upload-url`  │
│                        │ <───────────────────────────────── │                        │
└───────────┬────────────┘      2. Returns Presigned PUT URL   └────────────────────────┘
            │
            │ 3. Direct Binary PUT Upload
            ▼
┌────────────────────────┐
│  Cloudflare R2 Bucket  │ ──> Public CDN URL: https://media.yourdomain.com/...
└────────────────────────┘
```

1. **Client-side Image Compression**: When a user selects a dish or drink photo in `MenuManagerScreen`, `src/lib/r2.ts` automatically compresses the image to a WebP/JPEG format (max 1280px dimension, 80% quality).
2. **Presigned Upload URL**: The app calls the Supabase Edge Function `generate-upload-url`, which issues an S3-compatible 5-minute presigned PUT URL.
3. **Direct R2 Upload**: The client uploads the image directly to Cloudflare R2, bypassing your application server.
4. **Instant Display & Persistence**: The public CDN URL (e.g. `https://media.velvetlounge.gh/venues/{venueId}/products/{uuid}.webp`) is saved to the database product record (`products.images`).

---

## 🚀 Step-by-Step Provisioning Runbook

### Step 1: Create a Cloudflare R2 Bucket
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Navigate to **R2 Object Storage** in the sidebar.
3. Click **Create Bucket**.
4. Name your bucket (e.g., `nightos-media` or `velvet-lounge-assets`).
5. Click **Create Bucket**.

---

### Step 2: Configure Public Access / Custom Domain
1. Inside your R2 bucket settings, scroll down to **Public Access**.
2. Click **Connect Domain** (e.g. `media.velvetlounge.gh`) OR click **Allow Access** under **R2.dev Subdomain** to enable a public R2 URL.
3. Copy your public domain URL (e.g. `https://media.velvetlounge.gh` or `https://pub-xxx.r2.dev`).

---

### Step 3: Configure Bucket CORS Rules
Under your R2 bucket **Settings** → **CORS Policy**, add the following JSON policy to allow presigned uploads from your domain:

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

---

### Step 4: Create Cloudflare R2 API Tokens
1. In Cloudflare Dashboard → **R2** → **Manage R2 API Tokens** (right sidebar).
2. Under **Account API Tokens**, click **Create Account API token** (Recommended).
3. Permissions: Select **Object Read & Write** (or Edit / Admin Read & Write).
4. Apply to buckets: Select **All buckets** (or specify your bucket `nightos-media`).
5. Click **Create API Token**.
6. Copy and save the generated credentials:
   * **Access Key ID** (used for `R2_ACCESS_KEY_ID`)
   * **Secret Access Key** (used for `R2_SECRET_ACCESS_KEY`)
   * **Account ID** (found in Cloudflare URL: `https://dash.cloudflare.com/{ACCOUNT_ID}/r2` or `VITE_R2_ACCOUNT_ID`)

---

### Step 5: Configure Secrets in Supabase Edge Functions
In your **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets** (or via Supabase CLI), add the following secrets:

```bash
npx supabase secrets set \
  R2_ACCOUNT_ID="your-cloudflare-account-id" \
  R2_ACCESS_KEY_ID="your-r2-access-key-id" \
  R2_SECRET_ACCESS_KEY="your-r2-secret-access-key" \
  R2_BUCKET_NAME="your-r2-bucket-name" \
  R2_PUBLIC_URL="https://media.yourdomain.com"
```

---

### Step 6: Deploy Edge Functions to Supabase
Deploy the included Edge Functions located in `supabase/functions/`:

```bash
# Deploy generate-upload-url
npx supabase functions deploy generate-upload-url --project-ref uftbkgdyxwhrfplqtfcb --no-verify-jwt

# Deploy delete-r2-object
npx supabase functions deploy delete-r2-object --project-ref uftbkgdyxwhrfplqtfcb --no-verify-jwt
```

---

### Step 7: Configure Frontend `.env`
In your local `.env` file (copied from `.env.example`), set:

```dotenv
VITE_R2_PUBLIC_URL=https://media.velvetlounge.gh
VITE_R2_ACCOUNT_ID=your-cloudflare-account-id
```

---

## 🧪 Verification & Testing

1. Go to **Manager Portal** → **Menu & POS Catalog**.
2. Click **Add Menu Item** or edit an existing item.
3. Click **Upload Photo File** and pick a dish/drink image.
4. The client will compress the image, fetch the presigned URL, and upload directly to Cloudflare R2.
5. The high-res image URL will be saved to your Supabase `products.images` array and instantly displayed on the Guest Menu & Waiter POS!