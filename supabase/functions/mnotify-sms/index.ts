import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const MNOTIFY_API_KEY = Deno.env.get('MNOTIFY_API_KEY') || ''
// Case-sensitive! Must match the sender ID approved on the mnotify account
// (the battle-tested Vendly project uses "Vendly").
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

    if (body.sms?.otp && body.user?.phone) {
      const phone = formatPhone(body.user.phone)
      const message = `Your Bysen verification code is ${body.sms.otp}. Please do not share this with anyone.`

      // Visible in Supabase Edge Function logs — handy while testing OTP locally.
      console.log(`[mnotify-sms] OTP for ${phone}: ${body.sms.otp}`)

      if (!MNOTIFY_API_KEY) {
        console.error('[mnotify-sms] MNOTIFY_API_KEY secret is missing. Set it: supabase secrets set MNOTIFY_API_KEY=...')
        return new Response(JSON.stringify({ error: 'MNOTIFY_API_KEY not configured on the edge function' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('[mnotify-sms] calling api.mnotify.com ...')
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${MNOTIFY_API_KEY}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [phone],
            sender: MNOTIFY_SENDER_ID,
            message,
            is_schedule: false,
            schedule_date: '',
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        const result = await res.json()
        console.log(`[mnotify-sms] mnotify HTTP ${res.status} response: ${JSON.stringify(result)}`)

        const ok = res.ok && result?.status === 'success'
        if (!ok) {
          const detail = result?.message || result?.error || JSON.stringify(result)
          console.error(`[mnotify-sms] mnotify rejected the send: ${detail}`)
          return new Response(JSON.stringify({ error: `mnotify send failed: ${detail}` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        const detail = err?.message ?? String(err)
        console.error(`[mnotify-sms] mnotify call failed: ${detail}`)
        return new Response(JSON.stringify({ error: `mnotify call failed: ${detail}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (body.action === 'broadcast' && body.recipients?.length && body.message) {
      const recipients = body.recipients.map(formatPhone)

      const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${MNOTIFY_API_KEY}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipients,
          sender: MNOTIFY_SENDER_ID,
          message: body.message,
          is_schedule: false,
          schedule_date: '',
        }),
      })

      const result = await res.json()
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ status: 'noop' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[mnotify-sms] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
