import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const MNOTIFY_API_KEY = Deno.env.get('MNOTIFY_API_KEY') || ''
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
      const message = `Your NightOS verification code is ${body.sms.otp}. Please do not share this with anyone.`

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
      })

      const result = await res.json()
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
