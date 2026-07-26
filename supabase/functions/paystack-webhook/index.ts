import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const signature = req.headers.get('x-paystack-signature')
    const bodyText = await req.text()

    if (!PAYSTACK_SECRET_KEY || !signature) {
      return new Response('Unauthorized', { status: 401 })
    }

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
    )
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText))
    const hashHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (hashHex !== signature) {
      console.error('Invalid Paystack signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(bodyText)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const getMetadataField = (metadata: any, field: string) => {
      if (!metadata) return null
      if (metadata.custom_fields) {
        const f = metadata.custom_fields.find((f: any) => f.variable_name === field)
        if (f) return f.value
      }
      return metadata[field]
    }

    if (event.event === 'charge.success') {
      const data = event.data
      const reference = data.reference
      const billId = getMetadataField(data.metadata, 'bill_id')
      const venueId = getMetadataField(data.metadata, 'venue_id')

      if (!billId || !venueId) {
        return new Response('Missing bill_id or venue_id in metadata', { status: 200 })
      }

      const { data: existing } = await supabase
        .from('payment_events')
        .select('id')
        .eq('paystack_reference', reference)
        .maybeSingle()

      if (existing) {
        return new Response(JSON.stringify({ received: true, deduped: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      const { data: bill } = await supabase
        .from('bills')
        .select('total, venue_id, status')
        .eq('id', billId)
        .single()

      if (!bill) {
        return new Response('Bill not found', { status: 200 })
      }

      const expectedAmountPesewas = Math.round(bill.total * 100)
      if (data.amount !== expectedAmountPesewas) {
        console.error(`[webhook] Amount mismatch: expected ${expectedAmountPesewas}, got ${data.amount}`)
        await supabase.from('payment_events').insert({
          paystack_reference: reference,
          bill_id: billId,
          event_type: 'amount_mismatch_rejected',
          amount_pesewas: data.amount,
        })
        return new Response(JSON.stringify({ received: true, rejected: 'amount_mismatch' }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      await supabase.from('payments').insert({
        bill_id: billId,
        venue_id: bill.venue_id,
        amount: data.amount / 100,
        method: data.channel === 'ussd' ? 'mobile_money' : data.channel === 'card' ? 'card' : data.channel === 'bank' ? 'bank_transfer' : 'digital_wallet',
        reference: reference,
        status: 'success',
        paystack_data: data,
      })

      await supabase.from('payment_events').insert({
        paystack_reference: reference,
        bill_id: billId,
        event_type: event.event,
        amount_pesewas: data.amount,
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Edge Function Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
