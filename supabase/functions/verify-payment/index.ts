import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

    if (!PAYSTACK_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server missing PAYSTACK_SECRET_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Cache-Control': 'no-cache',
        },
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

    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('paystack_reference', reference)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed', deduped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const expectedAmountPesewas = Math.round(bill.total * 100)
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

    await supabase.from('payments').insert({
      bill_id: bill_id,
      venue_id: bill.venue_id,
      amount: data.amount / 100,
      method: data.channel === 'ussd' ? 'mobile_money' : data.channel === 'card' ? 'card' : data.channel === 'bank' ? 'bank_transfer' : 'digital_wallet',
      reference: reference,
      status: 'success',
      paystack_data: data,
    })

    await supabase.from('payment_events').insert({
      paystack_reference: reference,
      bill_id: bill_id,
      event_type: 'manual_verify',
      amount_pesewas: data.amount,
    })

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
