import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { expectedBillAmountPesewas } from '../_shared/fees.ts'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Constant-time hex comparison (avoids timing side-channels).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function getMetadataField(metadata: any, field: string): string | null {
  if (!metadata) return null
  if (metadata.custom_fields) {
    const f = metadata.custom_fields.find((f: any) => f.variable_name === field)
    if (f) return String(f.value)
  }
  const v = metadata[field]
  return v === undefined || v === null ? null : String(v)
}

function isUniqueViolation(err: any): boolean {
  return !!err && (err.code === '23505' || String(err.message || '').includes('duplicate key'))
}

serve(async (req) => {
  try {
    // 1. Verify Paystack HMAC signature before touching anything.
    const signature = req.headers.get('x-paystack-signature')
    const bodyText = await req.text()

    if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !signature) {
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

    if (!timingSafeEqualHex(hashHex, signature)) {
      console.error('Invalid Paystack signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(bodyText)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (event.event === 'charge.success') {
      const data = event.data
      const reference = data.reference
      const billId = getMetadataField(data.metadata, 'bill_id')
      const venueId = getMetadataField(data.metadata, 'venue_id')

      if (!billId || !venueId) {
        return new Response('Missing bill_id or venue_id in metadata', { status: 200 })
      }

      const { data: bill } = await supabase
        .from('bills')
        .select('total, venue_id, status')
        .eq('id', billId)
        .single()

      if (!bill) {
        return new Response('Bill not found', { status: 200 })
      }

      // 2. Already-paid bill: webhook replays must not re-credit.
      if (bill.status === 'paid') {
        return new Response(JSON.stringify({ received: true, deduped: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // 3. Amount gate — reject forged low-amount transactions.
      const expectedAmountPesewas = expectedBillAmountPesewas(bill)
      if (data.amount !== expectedAmountPesewas) {
        console.error(`[webhook] Amount mismatch: expected ${expectedAmountPesewas}, got ${data.amount} - NOT crediting`)
        await supabase
          .from('payment_events')
          .upsert(
            {
              paystack_reference: reference,
              bill_id: billId,
              event_type: 'amount_mismatch_rejected',
              amount_pesewas: data.amount,
            },
            { onConflict: 'paystack_reference', ignoreDuplicates: true }
          )
        // 200 so Paystack stops retrying a permanently-bad payload.
        return new Response(JSON.stringify({ received: true, rejected: 'amount_mismatch' }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // 4. ATOMIC idempotency guard (unique constraint on payments.reference).
      //    Racing verify-payment/webhook calls: only the winner inserts.
      const guard = await supabase
        .from('payments')
        .upsert(
          {
            bill_id: billId,
            venue_id: bill.venue_id,
            amount: data.amount / 100,
            method: data.channel === 'ussd' ? 'mobile_money' : data.channel === 'card' ? 'card' : data.channel === 'bank' ? 'bank_transfer' : 'digital_wallet',
            reference: reference,
            status: 'success',
            paystack_data: data,
          },
          { onConflict: 'reference', ignoreDuplicates: true }
        )

      if (guard.error) {
        if (isUniqueViolation(guard.error)) {
          console.log(`[webhook] Reference ${reference} already processed, skipping`)
          return new Response(JSON.stringify({ received: true, deduped: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          })
        }
        console.error('[webhook] Payment insert failed:', guard.error)
        return new Response(JSON.stringify({ error: guard.error.message }), { status: 500 })
      }

      // ignoreDuplicates: zero-length result means the row already existed.
      const inserted = (guard.data as unknown as unknown[] | null) ?? []
      if (inserted.length === 0) {
        console.log(`[webhook] Reference ${reference} already processed, skipping`)
        return new Response(JSON.stringify({ received: true, deduped: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // 5. Audit log (bill auto-close is a DB trigger, not duplicated here).
      await supabase
        .from('payment_events')
        .upsert(
          {
            paystack_reference: reference,
            bill_id: billId,
            event_type: event.event,
            amount_pesewas: data.amount,
          },
          { onConflict: 'paystack_reference', ignoreDuplicates: true }
        )
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Edge Function Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
