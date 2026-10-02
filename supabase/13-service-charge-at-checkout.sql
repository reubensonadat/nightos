-- ═════════════════════════════════════════════════════════════════════════════
-- 13 — Visible 10% Service Charge at Checkout + Paystack Subaccount Split
--
-- Why:
-- 1. The flat 10% platform fee was invisible to guests: bills.service_charge was
--    forced to 0 and the manager UI saved venues.service_charge_pct as 0.
-- 2. The legacy recalculate_single_bill applied a tiered "convenience fee"
--    (₵1–₵5) instead of a service charge — the last archaic tier remnant.
-- 3. payments.platform_fee must equal the service-charge share actually collected
--    in each payment (not 10% × gross) so cash fee debt matches reality.
-- 4. New bill math: service_charge = subtotal × venues.service_charge_pct,
--    VAT per venues.vat_pct (inclusive or exclusive), convenience_fee retired.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Retire the tiered convenience fee helper (no remaining callers)
DROP FUNCTION IF EXISTS public.compute_convenience_fee(numeric);

-- 2. Canonical bill math: subtotal + service charge (+ VAT when exclusive)
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

    UPDATE public.bills
    SET subtotal = COALESCE(v_subtotal, 0),
        convenience_fee = 0.00,
        service_charge = v_service,
        vat = v_vat,
        total = v_total,
        amount_paid = v_paid,
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

-- 3. Platform fee = the service-charge share actually collected in this payment.
--    Payments on a bill carrying a service charge are allocated proportionally
--    (deposit + final settlement sum to exactly the SC); payments without a
--    bill-linked service charge fall back to a flat 10%. Paystack's 2% gateway
--    fee only applies to digital methods — cash has none.
CREATE OR REPLACE FUNCTION public.fn_auto_compute_payment_fee_split()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_sc     numeric;
    v_btotal numeric;
BEGIN
    IF NEW.amount IS NOT NULL AND NEW.amount > 0 THEN
        SELECT b.service_charge, b.total INTO v_sc, v_btotal
        FROM public.bills b
        WHERE b.id = NEW.bill_id;

        IF v_sc IS NOT NULL AND v_sc > 0 AND v_btotal IS NOT NULL AND v_btotal > 0 AND NEW.amount <= v_btotal THEN
            NEW.platform_fee := ROUND(v_sc * (NEW.amount / v_btotal), 2);
        ELSE
            NEW.platform_fee := ROUND(NEW.amount * 0.10, 2);
        END IF;

        IF NEW.method IN ('card', 'mobile_money', 'paystack') THEN
            NEW.paystack_fee := ROUND(NEW.amount * 0.02, 2);
        ELSE
            NEW.paystack_fee := 0;
        END IF;

        NEW.net_platform_fee := GREATEST(NEW.platform_fee - NEW.paystack_fee, 0);
        NEW.venue_settlement := NEW.amount - NEW.platform_fee;
    END IF;
    RETURN NEW;
END;
$$;

-- ( trg_payment_fee_split from 09 keeps firing — only the function body changed )

-- 4. Backfill open/settling bills with the new math
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM public.bills WHERE status IN ('open', 'settling') LOOP
        PERFORM public.recalculate_single_bill(r.id);
    END LOOP;
END $$;

-- 5. Verify:
--   SELECT public.platform_fee_for(100);  -- expect 10.00
--   SELECT subtotal, service_charge, vat, total, amount_paid
--     FROM public.bills WHERE status IN ('open', 'settling');
