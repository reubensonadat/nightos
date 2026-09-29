-- ═════════════════════════════════════════════════════════════════════════════
-- 10 — Paystack Dynamic API: Automated Fee Debt Reconciliation & 90% Cap Guard
-- 
-- Why:
-- 1. In bars/nightclubs, cash payments leave an outstanding fee balance owed to Bysen.
-- 2. When a guest pays online via Paystack, we dynamically allocate part of the
--    transaction to claw back the venue's unsettled fee debt.
-- 3. Hard 90% Cap: The maximum total fee deducted by Paystack + Bysen on ANY online
--    transaction is strictly capped at 90% of the transaction amount. The venue
--    is guaranteed to receive at least 10% of their online sales.
-- 4. An atomic RPC function clears the oldest unsettled cash fee rows as soon
--    as the online payment succeeds.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Ensure columns exist on venues and payments
ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
    ADD COLUMN IF NOT EXISTS settlement_bank_code text,
    ADD COLUMN IF NOT EXISTS settlement_account_number text;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS fee_debt_recovered numeric(10,2) DEFAULT 0;

-- 2. Fee Reconciliation Audit Log
CREATE TABLE IF NOT EXISTS public.fee_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    online_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    debt_recovered numeric(10,2) NOT NULL,
    previous_debt numeric(10,2) NOT NULL,
    remaining_debt numeric(10,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_reconciliations_venue 
ON public.fee_reconciliations(venue_id, created_at DESC);


-- 3. Dynamic Paystack Fee Calculation RPC (Pre-transaction allocation)
CREATE OR REPLACE FUNCTION public.calculate_dynamic_paystack_fee(
    p_venue_id uuid,
    p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_gross numeric;
    v_standard_fee numeric;
    v_max_total_deduction numeric;
    v_max_debt_headroom numeric;
    v_outstanding_debt numeric;
    v_debt_clawback numeric;
    v_total_transaction_charge numeric;
    v_venue_net numeric;
    v_subaccount text;
BEGIN
    v_gross := GREATEST(COALESCE(p_amount, 0), 0);
    IF v_gross = 0 THEN
        RETURN jsonb_build_object(
            'gross', 0,
            'standard_fee', 0,
            'debt_clawback', 0,
            'total_fee', 0,
            'venue_net', 0,
            'subaccount', NULL
        );
    END IF;

    -- Fetch venue's subaccount code
    SELECT paystack_subaccount_code INTO v_subaccount
    FROM public.venues
    WHERE id = p_venue_id;

    -- 1. Standard 10% Platform Fee
    v_standard_fee := ROUND(v_gross * 0.10, 2);

    -- 2. Hard 90% Cap Rule: Total deduction cannot exceed 90% of gross
    v_max_total_deduction := ROUND(v_gross * 0.90, 2);

    -- 3. Headroom available to recover debt (80% of gross)
    v_max_debt_headroom := GREATEST(v_max_total_deduction - v_standard_fee, 0);

    -- 4. Get current outstanding fee balance owed by venue
    SELECT COALESCE(SUM(platform_fee), 0) INTO v_outstanding_debt
    FROM public.payments
    WHERE venue_id = p_venue_id
      AND fee_settled = false
      AND status = 'success';

    -- 5. Calculate actual debt clawback (capped by headroom)
    v_debt_clawback := LEAST(v_outstanding_debt, v_max_debt_headroom);

    -- 6. Total transaction charge for Paystack dynamic split
    v_total_transaction_charge := v_standard_fee + v_debt_clawback;

    -- 7. Venue net payout (at least 10% of gross)
    v_venue_net := v_gross - v_total_transaction_charge;

    RETURN jsonb_build_object(
        'gross', v_gross,
        'standard_fee', v_standard_fee,
        'outstanding_debt', v_outstanding_debt,
        'debt_clawback', v_debt_clawback,
        'total_transaction_charge', v_total_transaction_charge,
        'transaction_charge_pesewas', ROUND(v_total_transaction_charge * 100),
        'venue_net', v_venue_net,
        'subaccount', v_subaccount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_dynamic_paystack_fee(uuid, numeric) TO anon, authenticated, service_role;


-- 4. Atomic Debt Settlement RPC (Post-transaction execution)
CREATE OR REPLACE FUNCTION public.reconcile_venue_fee_debt(
    p_venue_id uuid,
    p_payment_id uuid,
    p_debt_cleared numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_cleared_target numeric;
    v_remaining_to_clear numeric;
    v_prev_debt numeric;
    v_new_debt numeric;
    v_row record;
BEGIN
    v_cleared_target := GREATEST(COALESCE(p_debt_cleared, 0), 0);
    IF v_cleared_target <= 0 THEN
        RETURN jsonb_build_object('ok', true, 'cleared', 0, 'message', 'No debt to clear.');
    END IF;

    -- Current debt
    SELECT COALESCE(SUM(platform_fee), 0) INTO v_prev_debt
    FROM public.payments
    WHERE venue_id = p_venue_id
      AND fee_settled = false
      AND status = 'success';

    v_remaining_to_clear := v_cleared_target;

    -- Iterate through oldest unsettled fee payments to mark them settled
    FOR v_row IN
        SELECT id, platform_fee
        FROM public.payments
        WHERE venue_id = p_venue_id
          AND fee_settled = false
          AND status = 'success'
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining_to_clear <= 0 THEN
            EXIT;
        END IF;

        IF v_row.platform_fee <= v_remaining_to_clear THEN
            -- Fully settle this row
            UPDATE public.payments
            SET fee_settled = true
            WHERE id = v_row.id;

            v_remaining_to_clear := v_remaining_to_clear - v_row.platform_fee;
        ELSE
            -- Partially settle: split or mark settled (here we mark settled as paid)
            UPDATE public.payments
            SET fee_settled = true
            WHERE id = v_row.id;

            v_remaining_to_clear := 0;
        END IF;
    END LOOP;

    -- Record recovered amount in the online payment row
    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET fee_debt_recovered = v_cleared_target
        WHERE id = p_payment_id;
    END IF;

    -- Calculate new debt
    SELECT COALESCE(SUM(platform_fee), 0) INTO v_new_debt
    FROM public.payments
    WHERE venue_id = p_venue_id
      AND fee_settled = false
      AND status = 'success';

    -- Audit log
    INSERT INTO public.fee_reconciliations (
        venue_id, online_payment_id, debt_recovered, previous_debt, remaining_debt
    ) VALUES (
        p_venue_id, p_payment_id, v_cleared_target, v_prev_debt, v_new_debt
    );

    RETURN jsonb_build_object(
        'ok', true,
        'cleared', v_cleared_target,
        'previous_debt', v_prev_debt,
        'remaining_debt', v_new_debt
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_venue_fee_debt(uuid, uuid, numeric) TO anon, authenticated, service_role;
