-- ═════════════════════════════════════════════════════════════════════════════
-- 19 — One Math Engine: recompute_bill_totals delegates to the deposit-first
--      recalculate_single_bill (migration 18)
--
-- Why:
-- 1. Migration 18 replaced recalculate_single_bill (SC base = spend beyond the
--    deposit) but MISSED recompute_bill_totals — migration 11's copy still
--    computes SC = pct × FULL subtotal and stamps its own total/status logic.
-- 2. set_bill_deposit (fired on EVERY deposit recording — recordDepositPayment
--    calls it first) and transfer_bill / merge_bills / split_bill all route
--    through recompute_bill_totals → every deposit landing re-stamped legacy
--    math onto the bill (phantom SC on deposit-covered spend: SC 2.10 on a
--    GH₵ 21 order under a GH₵ 2,000 deposit).
-- 3. Fix: recompute_bill_totals becomes a thin wrapper over the canonical
--    recalculate_single_bill, so every code path uses ONE math engine:
--    SC only on excess, total = full ledger spend, remaining_credit separate,
--    credit-guarded auto-close.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
BEGIN
    -- Canonical deposit-first math (migration 18).
    PERFORM public.recalculate_single_bill(p_bill_id);

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'subtotal', v_bill.subtotal,
        'service_charge', v_bill.service_charge,
        'vat', v_bill.vat,
        'deposit_amount', v_bill.deposit_amount,
        'deposit_paid', v_bill.deposit_paid,
        'remaining_credit', v_bill.remaining_credit,
        'total', v_bill.total,
        'amount_paid', v_bill.amount_paid,
        'amount_due', GREATEST(v_bill.total - v_bill.amount_paid, 0),
        'status', v_bill.status
    );
END;
$$;

-- ── Repair: recalc every live deposit bill with the unified engine ──
SELECT public.recalculate_single_bill(b.id)
  FROM public.bills b
 WHERE b.deposit_paid = true
   AND b.status IN ('open', 'settling');

-- ── Verify: the active deposit tab must stay 0 spend / 0 SC / full credit,
--    and NO live bill may carry a phantom service_charge on covered spend ──
SELECT b.id::text AS bill, b.status, b.subtotal, b.service_charge, b.total,
       b.amount_paid, b.remaining_credit
  FROM public.bills b
 WHERE b.deposit_paid = true
 ORDER BY b.created_at DESC;
