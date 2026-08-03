import { S3Client, DeleteObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.400.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const body = await req.json()
    const { objectKey, venueId } = body

    if (!objectKey || typeof objectKey !== 'string' || objectKey.trim() === '') {
      return new Response(JSON.stringify({ error: 'Missing required field: objectKey' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const key = objectKey.trim()

    // Verify the user is a member of this venue
    if (venueId) {
      const { data: isMember } = await supabase.rpc('is_venue_member', { target_venue_id: venueId })
      if (!isMember) {
        return new Response(JSON.stringify({ error: 'Forbidden: not a venue member' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
      // Optional: enforce key belongs to this venue
      const expectedPrefix = `venues/${venueId}/`
      if (!key.startsWith(expectedPrefix)) {
        return new Response(JSON.stringify({ error: 'Forbidden: object does not belong to this venue' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    })

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: Deno.env.get('R2_BUCKET_NAME')!,
        Key: key,
      })
    )

    return new Response(JSON.stringify({ success: true, deletedKey: key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Error deleting R2 object:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})