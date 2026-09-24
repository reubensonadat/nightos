-- ─────────────────────────────────────────────────────────────
-- 04 — Remove Service Charge & Update Fee Schedule + Bill Math
-- Run after 01-schema-and-logic.sql and 03-fee-guard.sql
--
-- What this does:
-- 1. Updates platform_fee_for() with the new upper limit fee tiers:
--      0 – 50 GHS    : ₵1.00
--      51 – 100 GHS  : ₵2.00
--      101 – 150 GHS : ₵3.00
--      151 – 200 GHS : ₵4.00
--      201 – 500 GHS : ₵7.00
--      501 – 700 GHS : ₵12.00
--      701+ GHS      : ₵15.00
--
-- 2. Removes service charge from venues and bills (zeroed out).
--
-- 3. Updates recalculate_bill() and recompute_bill_totals() so:
--    - When tax_inclusive = true: menu price is the final gross price,
--      VAT is extracted (GRA standard), and Subtotal (Net) + VAT = Total.
--    - When tax_inclusive = false: VAT is added on top of the subtotal.
--    - Service charge is NEVER added.
-- ─────────────────────────────────────────────────────────────

-- 1. Update Platform Fee Schedule
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT LEAST(
        CASE
            WHEN p_amount <= 50   THEN 1.00
            WHEN p_amount <= 100  THEN 2.00
            WHEN p_amount <= 150  THEN 3.00
            WHEN p_amount <= 200  THEN 4.00
            WHEN p_amount <= 500  THEN 7.00
            WHEN p_amount <= 700  THEN 12.00
            ELSE 15.00
        END,
        GREATEST(p_amount, 0)
    )::numeric(10,2);
$$;

-- 2. Zero out service charge defaults and existing records
ALTER TABLE public.venues
    ALTER COLUMN service_charge_pct SET DEFAULT 0.00;

UPDATE public.venues
SET service_charge_pct = 0.00
WHERE service_charge_pct <> 0.00;

ALTER TABLE public.bills
    ALTER COLUMN service_charge SET DEFAULT 0.00;

UPDATE public.bills
SET service_charge = 0.00
WHERE service_charge <> 0.00;

-- 3. Recompute trigger on order item change
CREATE OR REPLACE FUNCTION public.recalculate_bill()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
    v_tax_inclusive boolean;
    v_vat_pct numeric;
    v_gross_items numeric;
    v_subtotal numeric;
    v_vat numeric;
    v_total numeric;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    IF v_bill_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Fetch venue tax configuration
    SELECT COALESCE(v.tax_inclusive, true), COALESCE(v.vat_pct, 0)
    INTO v_tax_inclusive, v_vat_pct
    FROM public.bills b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = v_bill_id;

    -- Sum of all active order items on the bill
    SELECT COALESCE(SUM(oi.line_total), 0)
    INTO v_gross_items
    FROM public.order_items oi
    WHERE oi.bill_id = v_bill_id;

    IF v_vat_pct > 0 THEN
        IF v_tax_inclusive THEN
            -- Tax Inclusive: Menu prices already include VAT.
            -- The total is the exact sum of items. VAT is extracted:
            -- net = total / (1 + vat_pct / 100), vat = total - net.
            v_total := v_gross_items;
            v_subtotal := ROUND(v_gross_items / (1 + (v_vat_pct / 100)), 2);
            v_vat := v_total - v_subtotal;
        ELSE
            -- Tax Exclusive: VAT is added on top of item prices.
            v_subtotal := v_gross_items;
            v_vat := ROUND(v_subtotal * (v_vat_pct / 100), 2);
            v_total := v_subtotal + v_vat;
        END IF;
    ELSE
        -- No VAT
        v_subtotal := v_gross_items;
        v_vat := 0.00;
        v_total := v_gross_items;
    END IF;

    UPDATE public.bills b
    SET
        subtotal = v_subtotal,
        service_charge = 0.00,
        vat = v_vat,
        total = v_total
    WHERE b.id = v_bill_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recompute bill totals procedure (used in merge/split)
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_venue public.venues%ROWTYPE;
    v_gross_items numeric;
    v_subtotal numeric;
    v_vat numeric;
    v_total numeric;
    v_vat_pct numeric;
    v_tax_inclusive boolean;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;

    SELECT * INTO v_venue FROM public.venues WHERE id = v_bill.venue_id;
    v_vat_pct := COALESCE(v_venue.vat_pct, 0);
    v_tax_inclusive := COALESCE(v_venue.tax_inclusive, true);

    SELECT COALESCE(SUM(line_total), 0) INTO v_gross_items
    FROM public.order_items WHERE bill_id = p_bill_id;

    IF v_vat_pct > 0 THEN
        IF v_tax_inclusive THEN
            v_total := v_gross_items;
            v_subtotal := ROUND(v_gross_items / (1 + (v_vat_pct / 100)), 2);
            v_vat := v_total - v_subtotal;
        ELSE
            v_subtotal := v_gross_items;
            v_vat := ROUND(v_subtotal * (v_vat_pct / 100), 2);
            v_total := v_subtotal + v_vat;
        END IF;
    ELSE
        v_subtotal := v_gross_items;
        v_vat := 0.00;
        v_total := v_gross_items;
    END IF;

    UPDATE public.bills
    SET subtotal = v_subtotal,
        service_charge = 0.00,
        vat = v_vat,
        total = v_total,
        updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'subtotal', v_subtotal, 'vat', v_vat, 'total', v_total);
END;
$$;

-- 5. Recompute all open / settling bills with the new logic
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.bills WHERE status IN ('open', 'settling') LOOP
        PERFORM public.recompute_bill_totals(r.id);
    END LOOP;
END;
$$;
