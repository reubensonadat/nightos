import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { expectedBillAmountPesewas } from '../_shared/fees.ts'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reference, bill_id } = await req.json()

    if (!reference || !bill_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: reference, bill_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server missing required secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Ask Paystack directly — never trust the client's claim.
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    const verifyData = await verifyRes.json()

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      return new Response(
        JSON.stringify({
          error: 'Payment not verified',
          detail: verifyData.data?.gateway_response || 'Transaction not successful',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = verifyData.data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Load the bill — the server-side source of truth for the amount.
    const { data: bill } = await supabase
      .from('bills')
      .select('total, venue_id, status')
      .eq('id', bill_id)
      .single()

    if (!bill) {
      return new Response(
        JSON.stringify({ error: 'Bill not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Cross-check the client-supplied bill_id against the metadata
    //    captured when the Paystack transaction was initialized.
    const metaBillId = getMetadataField(data.metadata, 'bill_id')
    if (metaBillId && metaBillId !== bill_id) {
      console.error(`[verify-payment] Bill mismatch: request ${bill_id}, metadata ${metaBillId}`)
      return new Response(
        JSON.stringify({ error: 'Bill mismatch', detail: 'Transaction metadata does not match the requested bill.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Already-paid bill: a replay of a valid reference must not re-credit.
    if (bill.status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: 'Bill already paid', deduped: true, newStatus: 'paid' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Amount gate — reject forged low-amount transactions claiming a bigger bill.
    const expectedAmountPesewas = expectedBillAmountPesewas(bill)
    if (data.amount !== expectedAmountPesewas) {
      console.error(`[verify-payment] Amount mismatch: expected ${expectedAmountPesewas}, got ${data.amount}`)
      return new Response(
        JSON.stringify({
          error: 'Amount mismatch',
          detail: `Expected ${expectedAmountPesewas} pesewas, received ${data.amount}.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. ATOMIC idempotency guard. The unique constraint on payments.reference
    //    makes insert-vs-dedupe race-free: if verify-payment and paystack-webhook
    //    run concurrently for the same reference, only one wins.
    const guard = await supabase
      .from('payments')
      .upsert(
        {
          bill_id: bill_id,
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
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed', deduped: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('[verify-payment] Payment insert failed:', guard.error)
      return new Response(
        JSON.stringify({ error: 'Failed to record payment', detail: guard.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ignoreDuplicates: a zero-length result means the row already existed.
    const inserted = (guard.data as unknown as unknown[] | null) ?? []
    if (inserted.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed', deduped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Audit log (bill auto-close is a DB trigger, not duplicated here).
    await supabase
      .from('payment_events')
      .upsert(
        {
          paystack_reference: reference,
          bill_id: bill_id,
          event_type: 'manual_verify',
          amount_pesewas: data.amount,
        },
        { onConflict: 'paystack_reference', ignoreDuplicates: true }
      )

    const { data: updatedBill } = await supabase
      .from('bills')
      .select('status')
      .eq('id', bill_id)
      .single()

    return new Response(
      JSON.stringify({ success: true, newStatus: updatedBill?.status || 'paid' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[verify-payment] Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
