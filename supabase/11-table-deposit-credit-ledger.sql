-- ═════════════════════════════════════════════════════════════════════════════
-- 11 — Table Architecture: Prepaid Table Deposits & Dynamic Credit Deductions
--
-- Why:
-- 1. In high-end / VIP venues, tables often require an upfront Minimum Spend Deposit
--    (e.g., GH₵ 2,000 paid upfront via Paystack) before guests occupy the table.
-- 2. Consumable Credit Allowance: The deposit acts as a starting credit balance.
--    Every drink, bottle, and food order deducts from this deposit.
-- 3. Live Customer View: Instead of showing an amount to pay while credit remains,
--    the guest sees their "Remaining Table Credit Balance" (e.g. GH₵ 1,200 remaining).
-- 4. Exhaustion & Excess Spillover: Once all orders consume the full deposit credit,
--    the balance hits GH₵ 0. Subsequent orders accumulate as an excess payable bill total
--    (Amount Due = Total Consumed - Upfront Deposit).
-- 5. Strict Cancelled Orders Protection: Cancelled orders ('cancelled') NEVER deduct
--    from the deposit or count in the bill. Only waiters/managers can cancel orders.
-- 6. Zero-Deposit Fallback: Regular tables (min_deposit = 0) operate as standard
--    postpay tabs starting from GH₵ 0.00.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Schema Extensions
ALTER TABLE public.tables
    ADD COLUMN IF NOT EXISTS min_deposit numeric(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.bills
    ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS remaining_credit numeric(10,2) NOT NULL DEFAULT 0.00;

-- 2. Unified Recalculation Procedure for Bills with Deposit Credit Ledger
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_venue public.venues%ROWTYPE;
    v_gross_items numeric(10,2);
    v_subtotal numeric(10,2);
    v_service_charge numeric(10,2);
    v_vat numeric(10,2);
    v_gross_consumed numeric(10,2);
    v_deposit numeric(10,2);
    v_remaining_credit numeric(10,2);
    v_amount_due numeric(10,2);
    v_paid numeric(10,2);
    v_svc_pct numeric;
    v_vat_pct numeric;
    v_tax_inclusive boolean;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;

    SELECT * INTO v_venue FROM public.venues WHERE id = v_bill.venue_id;
    v_svc_pct := COALESCE(v_venue.service_charge_pct, 10.00);
    v_vat_pct := COALESCE(v_venue.vat_pct, 0.00);
    v_tax_inclusive := COALESCE(v_venue.tax_inclusive, true);

    -- Strictly exclude cancelled items
    SELECT COALESCE(SUM(oi.line_total), 0) INTO v_gross_items
    FROM public.order_items oi
    LEFT JOIN public.order_submissions os ON os.id = oi.submission_id
    WHERE oi.bill_id = p_bill_id
      AND COALESCE(oi.status, 'confirmed') != 'cancelled'
      AND (os.id IS NULL OR COALESCE(os.status, 'confirmed') != 'cancelled');

    -- Compute Subtotal and VAT based on venue tax configuration
    IF v_vat_pct > 0 AND v_tax_inclusive THEN
        v_subtotal := ROUND(v_gross_items / (1 + (v_vat_pct / 100)), 2);
        v_vat := v_gross_items - v_subtotal;
    ELSE
        v_subtotal := v_gross_items;
        v_vat := ROUND(v_subtotal * (v_vat_pct / 100), 2);
    END IF;

    -- Unified 10% Service Charge
    v_service_charge := ROUND(v_subtotal * (v_svc_pct / 100), 2);

    -- Gross Consumed Spend (all ordered and active food, drinks, service fee & taxes)
    IF v_tax_inclusive THEN
        v_gross_consumed := v_gross_items + v_service_charge;
    ELSE
        v_gross_consumed := v_subtotal + v_service_charge + v_vat;
    END IF;

    -- Prepaid Table Deposit Credit Ledger
    IF v_bill.deposit_paid AND COALESCE(v_bill.deposit_amount, 0) > 0 THEN
        v_deposit := v_bill.deposit_amount;
        -- Deduct orders from deposit credit
        v_remaining_credit := GREATEST(0.00, ROUND(v_deposit - v_gross_consumed, 2));
        -- Excess amount owed once deposit is fully exhausted
        v_amount_due := GREATEST(0.00, ROUND(v_gross_consumed - v_deposit, 2));
    ELSE
        v_deposit := 0.00;
        v_remaining_credit := 0.00;
        v_amount_due := v_gross_consumed;
    END IF;

    -- Existing payments made against this bill
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = p_bill_id AND status = 'success';

    UPDATE public.bills
    SET subtotal = v_subtotal,
        service_charge = v_service_charge,
        vat = v_vat,
        remaining_credit = v_remaining_credit,
        total = v_amount_due,
        amount_paid = v_paid,
        status = CASE
            WHEN v_amount_due <= 0.01 AND v_bill.deposit_paid AND v_deposit > 0 AND v_bill.status = 'settling' THEN 'paid'
            WHEN v_paid >= (v_amount_due - 0.01) AND v_amount_due > 0 THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            ELSE status
        END,
        closed_at = CASE
            WHEN v_paid >= (v_amount_due - 0.01) AND v_amount_due > 0 THEN now()
            ELSE closed_at
        END,
        updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object(
        'ok', true,
        'subtotal', v_subtotal,
        'service_charge', v_service_charge,
        'vat', v_vat,
        'gross_consumed', v_gross_consumed,
        'deposit_amount', v_deposit,
        'deposit_paid', v_bill.deposit_paid,
        'remaining_credit', v_remaining_credit,
        'amount_due', v_amount_due,
        'total', v_amount_due
    );
END;
$$;

-- 3. Also update recalculate_single_bill to route through recompute_bill_totals
CREATE OR REPLACE FUNCTION public.recalculate_single_bill(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.recompute_bill_totals(p_bill_id);
END;
$$;

-- 4. RPC to set or update upfront table deposit on a bill
CREATE OR REPLACE FUNCTION public.set_bill_deposit(
    p_bill_id uuid,
    p_deposit_amount numeric,
    p_deposit_paid boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.bills
    SET deposit_amount = GREATEST(COALESCE(p_deposit_amount, 0), 0),
        deposit_paid = p_deposit_paid,
        updated_at = now()
    WHERE id = p_bill_id;

    RETURN public.recompute_bill_totals(p_bill_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_bill_totals(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_single_bill(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_bill_deposit(uuid, numeric, boolean) TO anon, authenticated, service_role;
