-- ═══════════════════════════════════════════════════════════════════════════
-- 18 — DEPOSIT-FIRST FEES: the platform's 10% is taken when money lands.
--
-- Owner decision (2026-10-03, after the NIGHTOS-MUSG8RIC-XQKA incident where
-- a GH₵ 2,000 deposit settled 100% to the venue subaccount):
--   1. The deposit charge carries transaction_charge = 10% of the deposit
--      (Paystack split) — the platform is paid THE MOMENT money enters.
--      Frontend hardening in PaystackButton guarantees a subaccount charge
--      never goes out without a platform cut, so this never relies on the
--      fee-debt clawback again.
--   2. The guest still sees the FULL deposit as credit. Credit draws down at
--      menu prices — remaining_credit = GREATEST(deposit − subtotal, 0).
--   3. NO service charge is stacked on deposit-covered spend at checkout
--      (that fee already came out of the deposit's other end). The service
--      charge applies ONLY to spend beyond the deposit: order 2,200 on a
--      2,000 deposit → excess 200 + 10% (20) → GH₵ 220 due at checkout.
--   4. Unused credit is FORFEITED (deposit = minimum spend). No refunds.
--   5. Regular no-deposit tables are unchanged: full 10% service charge on
--      the subtotal at checkout, platform fee via the split on payment.
--
-- Math change (this migration): the service-charge BASE for deposit bills is
-- GREATEST(subtotal − deposit, 0) instead of the full subtotal. Everything
-- else — total = subtotal + SC (+ VAT when exclusive), remaining_credit =
-- GREATEST(deposit − total, 0), the migration-17 credit guard — already
-- composes correctly with that single change.
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
    v_status   text;
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

    -- Deposit state first — the fee base depends on it.
    SELECT COALESCE(deposit_paid, false), COALESCE(deposit_amount, 0), status
      INTO v_dep_paid, v_dep, v_status
    FROM public.bills
    WHERE id = p_bill_id;

    -- DEPOSIT-FIRST FEES: on a deposit bill the service charge applies ONLY
    -- to spend beyond the deposit (the deposit's own 10% was collected by
    -- the Paystack split when the deposit was paid). No-deposit bills charge
    -- it on the full subtotal as before.
    v_service := ROUND(
        (CASE WHEN v_dep_paid
              THEN GREATEST(COALESCE(v_subtotal, 0) - v_dep, 0)
              ELSE COALESCE(v_subtotal, 0)
         END) * COALESCE(v_sc_pct, 0) / 100.0, 2);

    IF COALESCE(v_vat_pct, 0) > 0 THEN
        IF v_tax_incl THEN
            v_vat   := ROUND(v_subtotal - (v_subtotal / (1 + v_vat_pct / 100.0)), 2);
            v_total := v_subtotal + v_service;
        ELSE
            v_vat   := ROUND(v_subtotal * v_vat_pct / 100.0, 2);
            v_total := v_subtotal + v_service + v_vat;
        END IF;
    ELSE
        v_total := v_subtotal + v_service;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = p_bill_id AND status = 'success';

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
            WHEN v_status IN ('cancelled', 'closed') THEN v_status
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0
                 AND NOT (v_dep_paid AND (v_dep - v_total) > 0.005) THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            WHEN v_status = 'paid' AND v_paid < (v_total - 0.01) THEN 'open'
            ELSE v_status
        END,
        closed_at = CASE
            WHEN v_status IN ('cancelled', 'closed') THEN closed_at
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0
                 AND NOT (v_dep_paid AND (v_dep - v_total) > 0.005) THEN now()
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_single_bill(uuid) TO anon, authenticated, service_role;

-- ═══ DATA REPAIR — restate live deposit bills under the new fee model ═══
-- (executable, idempotent). E.g. bill 38418bdf (orders 1,820, deposit 2,000):
-- SC 182.00 → 0.00, total 2,002.00 → 1,820.00, remaining_credit 0.00 → 180.00,
-- amount due → 0.00 while the guest still has credit to spend.
SELECT public.recalculate_single_bill(b.id)
  FROM public.bills b
 WHERE b.deposit_paid = true
   AND b.status IN ('open', 'settling');

-- VERIFY — expect 38418bdf: service_charge 0.00, total 1820.00,
-- remaining_credit 180.00, status settling:
SELECT LEFT(id::text, 8) AS bill, status, subtotal, service_charge, vat,
       total, amount_paid, remaining_credit
  FROM public.bills
 WHERE deposit_paid = true
 ORDER BY updated_at DESC LIMIT 5;
