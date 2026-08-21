import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MNOTIFY_API_KEY = Deno.env.get('MNOTIFY_API_KEY') || ''
// Case-sensitive! Must match the sender ID approved on the mnotify account
const MNOTIFY_SENDER_ID = Deno.env.get('MNOTIFY_SENDER_ID') || 'Vendly'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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
      const otpCode = String(body.sms.otp)
      const message = `Your Bysen verification code is ${otpCode}. Please do not share this with anyone.`

      // Always log OTP for development debugging
      console.log(`[mnotify-sms] OTP for ${phone}: ${otpCode}`)

      // ── Store OTP in public.otp_codes for easy testing & lookup ──
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          await supabase.from('otp_codes').insert({
            phone,
            code: otpCode,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            is_used: false,
          })
          console.log(`[mnotify-sms] Successfully stored OTP in otp_codes for ${phone}`)
        } catch (dbErr) {
          console.error('[mnotify-sms] Failed to store OTP in DB:', dbErr)
        }
      }

      // If MNOTIFY_API_KEY is not configured, return success early so login works in dev
      if (!MNOTIFY_API_KEY) {
        console.warn('[mnotify-sms] MNOTIFY_API_KEY missing - OTP stored in DB only.')
        return new Response(JSON.stringify({ status: 'stored_in_db', phone, otp: otpCode }), {
          status: 200,
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
        console.log(`[mnotify-sms] mnotify response: ${JSON.stringify(result)}`)

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        console.error(`[mnotify-sms] mnotify send failed: ${err}`)
        // Return 200 with stored status so auth flow does not break if SMS provider fails
        return new Response(JSON.stringify({ status: 'stored_in_db', error: String(err) }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (body.action === 'broadcast' && body.recipients?.length && body.message) {
      const recipients = body.recipients.map(formatPhone)

      if (!MNOTIFY_API_KEY) {
        return new Response(JSON.stringify({ status: 'noop_no_key' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[mnotify-sms] Error:', errorMsg)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
