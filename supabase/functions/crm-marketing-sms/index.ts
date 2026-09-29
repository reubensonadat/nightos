import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MNOTIFY_API_KEY = Deno.env.get('MNOTIFY_API_KEY') || ''
// Case-sensitive! Must match the sender ID approved on the mnotify account
const MNOTIFY_SENDER_ID = Deno.env.get('MNOTIFY_SENDER_ID') || 'Vendly'

function formatPhone(phone: string): string {
  let p = phone.replace(/\s+/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  if (p.startsWith('0')) p = '233' + p.slice(1)
  return p
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()

    // Extract recipients flexibly from any payload shape
    const rawRecipients: string[] = [
      ...(Array.isArray(body.recipients) ? body.recipients : []),
      ...(typeof body.recipient === 'string' ? [body.recipient] : Array.isArray(body.recipient) ? body.recipient : []),
      ...(typeof body.phone === 'string' ? [body.phone] : []),
      ...(typeof body.to === 'string' ? [body.to] : []),
    ].filter(Boolean)

    const message: string = (body.message || body.sms_message || body.text || '').trim()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message content is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (rawRecipients.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one recipient phone number is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipients = [...new Set(rawRecipients.map(formatPhone))]
    console.log(`[crm-marketing-sms] Dispatching to ${recipients.length} recipients: "${message.slice(0, 60)}..."`)

    // Development mode fallback when MNOTIFY_API_KEY is not configured
    if (!MNOTIFY_API_KEY) {
      console.warn('[crm-marketing-sms] MNOTIFY_API_KEY missing - simulated campaign delivery.')
      return new Response(JSON.stringify({
        status: 'success',
        mode: 'mock_dev',
        count: recipients.length,
        recipients,
        message: 'MNOTIFY_API_KEY missing in Supabase secrets - simulated delivery for development.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${MNOTIFY_API_KEY}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: recipients,
        sender: MNOTIFY_SENDER_ID,
        message,
        is_schedule: false,
        schedule_date: '',
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const result = await res.json()
    console.log(`[crm-marketing-sms] mnotify response:`, JSON.stringify(result))

    return new Response(JSON.stringify({ ...result, success: true, count: recipients.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[crm-marketing-sms] Error:', errorMsg)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
