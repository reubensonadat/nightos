-- ═════════════════════════════════════════════════════════════════════════════
-- 20 — Safe VIP Deposit Recording, Duplicate Bill Merge & Cash Fee Tracking
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_deposit_payment_with_merge(
    p_venue_id uuid,
    p_table_id uuid,
    p_bill_id uuid,
    p_amount numeric,
    p_reference text,
    p_method text DEFAULT 'paystack',
    p_staff_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_primary_bill_id uuid;
    v_primary_bill public.bills%ROWTYPE;
    v_platform_fee numeric;
    v_fee_settled boolean;
BEGIN
    -- 1. Compute 10% platform fee for Bysen
    v_platform_fee := ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.10, 2);
    -- Cash payments accrue as unsettled fee debt owed to Bysen; digital settled upfront
    v_fee_settled := (p_method != 'cash' AND p_method != 'cash_deposit');

    -- 2. Check if another active, deposit-paid bill already exists for this EXACT venue AND table
    SELECT id INTO v_primary_bill_id
      FROM public.bills
     WHERE venue_id = p_venue_id
       AND table_id = p_table_id
       AND id != p_bill_id
       AND status IN ('open', 'settling')
       AND deposit_paid = true
     ORDER BY created_at ASC
     LIMIT 1;

    -- ══════════════════════════════════════════════════════════════════════════
    -- CASE A: Duplicate deposit on already-unlocked table (Safe Atomic Merge)
    -- ══════════════════════════════════════════════════════════════════════════
    IF v_primary_bill_id IS NOT NULL THEN
        -- Acquire exclusive row lock on the primary bill
        SELECT * INTO v_primary_bill 
          FROM public.bills 
         WHERE id = v_primary_bill_id 
           FOR UPDATE;

        -- 1. Increase primary bill's deposit balance
        UPDATE public.bills
           SET deposit_amount = deposit_amount + p_amount,
               assistance_type = NULL,
               updated_at = now()
         WHERE id = v_primary_bill_id;

        -- 2. Record payment row under primary bill with Bysen platform fee tracking
        INSERT INTO public.payments (
            bill_id, venue_id, amount, method, reference, status, 
            payer_name, server_id, platform_fee, fee_settled
        ) VALUES (
            v_primary_bill_id, p_venue_id, p_amount, p_method, p_reference, 'success', 
            CASE WHEN p_method = 'cash' THEN 'VIP Cash Deposit (Duplicate Merged)' ELSE 'VIP Table Deposit (Duplicate Merged)' END,
            p_staff_id, v_platform_fee, v_fee_settled
        ) ON CONFLICT (reference) DO NOTHING;

        -- 3. Re-assign customer sessions
        UPDATE public.customer_sessions
           SET bill_id = v_primary_bill_id
         WHERE bill_id = p_bill_id;

        -- 4. Re-assign orders
        UPDATE public.orders
           SET bill_id = v_primary_bill_id
         WHERE bill_id = p_bill_id;

        -- 5. Mark duplicate bill as cancelled
        UPDATE public.bills
           SET status = 'cancelled',
               assistance_type = NULL,
               notes = 'Merged duplicate deposit into active bill: ' || v_primary_bill_id::text,
               updated_at = now()
         WHERE id = p_bill_id;

        -- 6. Recalculate unified totals
        PERFORM public.recalculate_single_bill(v_primary_bill_id);

        RETURN jsonb_build_object(
            'ok', true,
            'merged', true,
            'active_bill_id', v_primary_bill_id,
            'total_deposit_amount', v_primary_bill.deposit_amount + p_amount,
            'platform_fee', v_platform_fee
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════════
    -- CASE B: Standard first deposit on this table
    -- ══════════════════════════════════════════════════════════════════════════
    UPDATE public.bills
       SET deposit_amount = p_amount,
           deposit_paid = true,
           assistance_type = NULL,
           updated_at = now()
     WHERE id = p_bill_id
       AND venue_id = p_venue_id
       AND table_id = p_table_id;

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, status, 
        payer_name, server_id, platform_fee, fee_settled
    ) VALUES (
        p_bill_id, p_venue_id, p_amount, p_method, p_reference, 'success', 
        CASE WHEN p_method = 'cash' THEN 'VIP Cash Deposit' ELSE 'VIP Table Deposit' END,
        p_staff_id, v_platform_fee, v_fee_settled
    ) ON CONFLICT (reference) DO NOTHING;

    PERFORM public.recalculate_single_bill(p_bill_id);

    RETURN jsonb_build_object(
        'ok', true,
        'merged', false,
        'active_bill_id', p_bill_id,
        'total_deposit_amount', p_amount,
        'platform_fee', v_platform_fee
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_deposit_payment_with_merge(uuid, uuid, uuid, numeric, text, text, uuid) TO anon, authenticated, service_role;
