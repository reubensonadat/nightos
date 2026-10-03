-- ═══════════════════════════════════════════════════════════════════════════
-- 15 — DEPOSIT-AWARE BILL RECALC: remaining_credit is always true
--
-- Incident (2026-10-02, Memories Night Club): VIP guest's GH₵ 2,000 deposit
-- showed "Remaining Credit 2,000.00" AFTER consuming GH₵ 2,273.92 of orders —
-- the credit row was written once at deposit time and never maintained,
-- because the deposit-ledger RPC (migration 11) is not on the order trigger
-- path. recalculate_single_bill (the function every order/payment trigger
-- fires) is now the single owner of this column.
--
-- Semantics (per the table-deposit PRD):
--   remaining_credit = GREATEST(deposit − total, 0)   when deposit_paid
--   remaining_credit = 0                              otherwise
--   Deposit NETTING into what the guest owes needs no new code: the deposit
--   lands as a success payments row (fixed by migration 14), so
--   amount_paid carries it and checkout's due = total − amount_paid.
--
-- NOTE: deposit-paid bills whose deposit payment row predates migration 14
-- need a one-time manual backfill INSERT (see ops notes in migration 14).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalculate_single_bill(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_subtotal numeric(10,2);
    v_sc_pct   numeric;
    v_vat_pct  numeric;
    v_tax_incl boolean;
    v_service  numeric(10,2) := 0;
    v_vat      numeric(10,2) := 0;
    v_total    numeric(10,2) := 0;
    v_paid     numeric(10,2) := 0;
    v_dep_paid boolean := false;
    v_dep      numeric(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(oi.line_total), 0) INTO v_subtotal
    FROM public.order_items oi
    JOIN public.order_submissions os ON os.id = oi.submission_id
    WHERE oi.bill_id = p_bill_id
      AND COALESCE(oi.status, 'confirmed') != 'cancelled'
      AND COALESCE(os.status, 'confirmed') != 'cancelled';

    SELECT v.service_charge_pct, v.vat_pct, COALESCE(v.tax_inclusive, false)
      INTO v_sc_pct, v_vat_pct, v_tax_incl
    FROM public.bills b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = p_bill_id;

    -- Service charge: flat % of the order subtotal (Bysen standard: 10%)
    v_service := ROUND(COALESCE(v_subtotal, 0) * COALESCE(v_sc_pct, 0) / 100.0, 2);

    IF COALESCE(v_vat_pct, 0) > 0 THEN
        IF v_tax_incl THEN
            -- Menu prices already contain VAT: extract for display, do not add
            v_vat   := ROUND(v_subtotal - (v_subtotal / (1 + v_vat_pct / 100.0)), 2);
            v_total := v_subtotal + v_service;
        ELSE
            -- VAT added at checkout (matches the checkout screen rows)
            v_vat   := ROUND(v_subtotal * v_vat_pct / 100.0, 2);
            v_total := v_subtotal + v_service + v_vat;
        END IF;
    ELSE
        v_total := v_subtotal + v_service;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = p_bill_id AND status = 'success';

    SELECT COALESCE(deposit_paid, false), COALESCE(deposit_amount, 0)
      INTO v_dep_paid, v_dep
    FROM public.bills
    WHERE id = p_bill_id;

    UPDATE public.bills
    SET subtotal = COALESCE(v_subtotal, 0),
        convenience_fee = 0.00,
        service_charge = v_service,
        vat = v_vat,
        total = v_total,
        amount_paid = v_paid,
        remaining_credit = CASE
            WHEN v_dep_paid THEN GREATEST(v_dep - v_total, 0)
            ELSE 0
        END,
        status = CASE
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            WHEN status = 'paid' AND v_paid < (v_total - 0.01) THEN 'open'
            ELSE status
        END,
        closed_at = CASE WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN now() ELSE closed_at END,
        updated_at = now()
    WHERE id = p_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_single_bill(uuid) TO anon, authenticated, service_role;

-- ═══ VERIFY ═══
-- On the recovered deposit bill (after the RECOVERY-DEPOSIT backfill INSERT):
--   SELECT public.recalculate_single_bill('08474179-b48e-486a-a95f-212fe0fbc208');
--   SELECT total, amount_paid, remaining_credit, status FROM public.bills
--    WHERE id = '08474179-b48e-486a-a95f-212fe0fbc208';
--   Expect: 2,273.92 | 2,000.00 | 0.00 | settling
-- Fresh deposit scenario: deposit 2,000, orders total 880 →
--   remaining_credit 1,120.00, amount_paid 2,000, status 'paid' (credit covers it).
