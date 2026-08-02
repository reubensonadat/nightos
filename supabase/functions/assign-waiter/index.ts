import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { bill_id } = await req.json()
    if (!bill_id) {
      return new Response(
        JSON.stringify({ error: 'Missing bill_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: waiterId, error: rpcError } = await supabase.rpc('assign_waiter_to_bill', {
      p_bill_id: bill_id,
    })

    if (rpcError) {
      console.error('[assign-waiter] RPC error:', rpcError)
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let waiterName: string | null = null
    if (waiterId) {
      const { data: staff } = await supabase
        .from('staff')
        .select('name')
        .eq('id', waiterId)
        .single()
      waiterName = staff?.name ?? null
    }

    return new Response(
      JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[assign-waiter] Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
