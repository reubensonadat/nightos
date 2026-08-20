import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { expectedBillAmountPesewas, mapPaystackChannel } from '../_shared/fees.ts'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// GHS rounding tolerance for "is the bill covered" (matches the DB trigger).
const COVERED_TOLERANCE_PESEWAS = 0.5

// Constant-time hex comparison (avoids timing side-channels).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function getMetadataField(metadata: Record<string, unknown> | null | undefined, field: string): string | null {
  if (!metadata) return null
  if (Array.isArray(metadata.custom_fields)) {
    const f = metadata.custom_fields.find((f: unknown) => {
      const fieldObj = f as Record<string, unknown>;
      return fieldObj && fieldObj.variable_name === field;
    }) as Record<string, unknown> | undefined;
    if (f && f.value !== undefined) return String(f.value)
  }
  const v = metadata[field]
  return v === undefined || v === null ? null : String(v)
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;
    return errorObj.code === '23505' || String(errorObj.message || '').includes('duplicate key');
  }
  return false;
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

    // ── charge.success: record a successful payment ──
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
        .select('total, amount_paid, venue_id, status')
        .eq('id', billId)
        .single()

      if (!bill) {
        return new Response('Bill not found', { status: 200 })
      }

      // 2. Already-covered bill: webhook replays must not re-credit.
      const remainingPesewas = expectedBillAmountPesewas(bill)
      if (bill.status === 'paid' || remainingPesewas <= COVERED_TOLERANCE_PESEWAS) {
        return new Response(JSON.stringify({ received: true, deduped: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // 3. Amount gate — remaining balance only. Rejects forged low-amount
      //    transactions AND overpayment.
      if (data.amount !== remainingPesewas) {
        console.error(`[webhook] Amount mismatch: expected ${remainingPesewas}, got ${data.amount} - NOT crediting`)
        await supabase
          .from('payment_events')
          .upsert(
            {
              paystack_reference: reference,
              bill_id: billId,
              event_type: 'amount_mismatch_rejected',
              amount_pesewas: data.amount,
              raw_payload: data,
            },
            { onConflict: 'paystack_reference,event_type', ignoreDuplicates: true }
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
            method: mapPaystackChannel(data.channel),
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
            raw_payload: data,
          },
          { onConflict: 'paystack_reference,event_type', ignoreDuplicates: true }
        )
    }

    // ── Refunds: charge.refund / refund.processed → mark payment refunded,
    //    reopen the bill if it drops back under total (§4.2.6). ──
    if (event.event === 'charge.refund' || event.event === 'refund.processed') {
      const data = event.data
      const reference = data?.reference || data?.transaction?.reference
      if (!reference) {
        return new Response(JSON.stringify({ received: true, note: 'no reference' }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // Log the refund event first — it must survive even if the payment
      // row lookup fails (auditability, Invariant 6).
      await supabase
        .from('payment_events')
        .upsert(
          {
            paystack_reference: reference,
            event_type: event.event,
            amount_pesewas: data?.amount ?? null,
            raw_payload: data,
          },
          { onConflict: 'paystack_reference,event_type', ignoreDuplicates: true }
        )

      const { data: payment } = await supabase
        .from('payments')
        .select('id, bill_id, status, amount')
        .eq('reference', reference)
        .single()

      if (!payment) {
        console.log(`[webhook] Refund for unknown reference ${reference}, logged only`)
        return new Response(JSON.stringify({ received: true, note: 'unknown reference' }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        })
      }

      // Only flip a success payment once; idempotent on replay.
      if (payment.status !== 'refunded') {
        await supabase
          .from('payments')
          .update({ status: 'refunded' })
          .eq('id', payment.id)

        // Reopen the bill if it was paid and is now under total.
        const { data: bill } = await supabase
          .from('bills')
          .select('total, amount_paid, status')
          .eq('id', payment.bill_id)
          .single()

        if (bill && bill.status === 'paid') {
          const newPaid = Number(bill.amount_paid) - Number(payment.amount)
          const { data: updated } = await supabase
            .from('bills')
            .update({
              amount_paid: Math.max(newPaid, 0),
              status: Math.max(newPaid, 0) >= bill.total - 0.005 ? 'paid' : 'settling',
            })
            .eq('id', payment.bill_id)
            .select('status')
            .single()
          console.log(`[webhook] Refund applied, bill ${payment.bill_id} → ${updated?.status}`)
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Edge Function Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
