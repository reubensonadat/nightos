-- ─────────────────────────────────────────────────────────────
-- 04 — Unified 10% Service Charge & Bar Architecture
-- Run after 01-schema-and-logic.sql and 03-fee-guard.sql.
--
-- Why:
-- 1. Replaces the ₵1, ₵2, ₵3, ₵4, ₵5+ tiered platform fee schedule
--    with a flat, transparent 10% service charge.
-- 2. Integrates service charge into bill totals inside recompute_bill_totals.
-- 3. Sets venue default service_charge_pct to 10.00%.
-- 4. Supports Nightclub & Pure Bar operational settings (KDS toggle,
--    VIP table upfront deposit credit ~GH₵ 2,000+).
-- ─────────────────────────────────────────────────────────────

-- 1. Unified 10% Service / Platform Fee
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT LEAST(
        ROUND(GREATEST(p_amount, 0) * 0.10, 2),
        GREATEST(p_amount, 0)
    )::numeric(10,2);
$$;

-- 2. Update venue default service charge to 10.00%
ALTER TABLE public.venues
    ALTER COLUMN service_charge_pct SET DEFAULT 10.00;

UPDATE public.venues
SET service_charge_pct = 10.00
WHERE service_charge_pct IS NULL OR service_charge_pct = 0.00;

-- 3. Recompute bill totals with 10% service charge + VAT
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_venue public.venues%ROWTYPE;
    v_gross_items numeric;
    v_subtotal numeric;
    v_service_charge numeric;
    v_vat numeric;
    v_total numeric;
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

    SELECT COALESCE(SUM(line_total), 0) INTO v_gross_items
    FROM public.order_items
    WHERE bill_id = p_bill_id
      AND status != 'cancelled';

    IF v_vat_pct > 0 AND v_tax_inclusive THEN
        v_subtotal := ROUND(v_gross_items / (1 + (v_vat_pct / 100)), 2);
        v_vat := v_gross_items - v_subtotal;
    ELSE
        v_subtotal := v_gross_items;
        v_vat := ROUND(v_subtotal * (v_vat_pct / 100), 2);
    END IF;

    v_service_charge := ROUND(v_subtotal * (v_svc_pct / 100), 2);

    IF v_tax_inclusive THEN
        v_total := v_gross_items + v_service_charge;
    ELSE
        v_total := v_subtotal + v_service_charge + v_vat;
    END IF;

    UPDATE public.bills
    SET subtotal = v_subtotal,
        service_charge = v_service_charge,
        vat = v_vat,
        total = v_total,
        updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object(
        'ok', true,
        'subtotal', v_subtotal,
        'service_charge', v_service_charge,
        'vat', v_vat,
        'total', v_total
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_bill_totals(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_fee_for(numeric) TO anon, authenticated, service_role;
