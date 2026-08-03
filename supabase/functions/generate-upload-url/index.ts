import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.400.0'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.400.0'

const ALLOWED_MIME_TYPES: Record<string, number> = {
  'image/jpeg': 5 * 1024 * 1024,
  'image/jpg': 5 * 1024 * 1024,
  'image/png': 5 * 1024 * 1024,
  'image/webp': 5 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'image/heic': 5 * 1024 * 1024,
  'image/heif': 5 * 1024 * 1024,
}

const PRESIGNED_URL_TTL_SECONDS = 300

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { fileName, fileType, fileSize, venueId, folder = 'products' } = body

    if (!fileName || !fileType || typeof fileSize !== 'number' || !venueId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const maxAllowedSize = ALLOWED_MIME_TYPES[fileType]
    if (!maxAllowedSize) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (fileSize > maxAllowedSize) {
      return new Response(JSON.stringify({ error: 'File too large' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const ext = fileName.split('.').pop() || 'bin'
    const objectKey = `venues/${venueId}/${folder}/${crypto.randomUUID()}.${ext}`

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    })

    const cacheControl = 'public, max-age=31536000, immutable'

    const presignedUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({
        Bucket: Deno.env.get('R2_BUCKET_NAME')!,
        Key: objectKey,
        ContentType: fileType,
        CacheControl: cacheControl,
      }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS }
    )

    const publicUrl = `${Deno.env.get('R2_PUBLIC_URL')}/${objectKey}`

    return new Response(JSON.stringify({ presignedUrl, publicUrl, objectKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Error generating upload URL:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})