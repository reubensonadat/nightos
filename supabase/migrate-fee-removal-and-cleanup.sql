-- ============================================================
-- NIGHTOS MIGRATION — Fee removal + schema cleanup
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Covers:
--   1. Remove convenience_fee entirely (bills column, compute
--      function, and every function that adds it to bill.total)
--   2. Drop legacy tables profiles / venue_staff + the
--      on_auth_user_created trigger that populated profiles
--   3. Rebuild get_venue_by_staff_phone / check_phone_exists
--      against the current staff / customer_profiles tables
--      (they still reference the dropped legacy tables)
--
-- After this runs, bill totals are: subtotal + service_charge + vat
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. REMOVE CONVENIENCE FEE
-- ────────────────────────────────────────────────────────────

-- 1a. Rebuild recalculate_bill (fires on order_items change)
--     WITHOUT the convenience_fee line.
CREATE OR REPLACE FUNCTION public.recalculate_bill()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    UPDATE public.bills b
    SET
        subtotal = (SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id),
        service_charge = ROUND((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id) * (SELECT COALESCE(service_charge_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id), 2),
        vat = ROUND((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id) * (SELECT COALESCE(vat_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id), 2)
    WHERE b.id = v_bill_id;
    UPDATE public.bills b SET total = subtotal + service_charge + vat WHERE b.id = v_bill_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1b. Rebuild recompute_bill_totals (used by transfer/merge/split)
--     WITHOUT the convenience fee.
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_venue public.venues%ROWTYPE;
    v_subtotal numeric;
    v_service numeric;
    v_vat numeric;
    v_total numeric;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;

    SELECT * INTO v_venue FROM public.venues WHERE id = v_bill.venue_id;

    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.order_items WHERE bill_id = p_bill_id;

    v_service := ROUND(v_subtotal * v_venue.service_charge_pct / 100, 2);
    v_vat := ROUND(v_subtotal * v_venue.vat_pct / 100, 2);
    v_total := v_subtotal + v_service + v_vat;

    UPDATE public.bills
    SET subtotal = v_subtotal, service_charge = v_service,
        vat = v_vat, total = v_total, updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'subtotal', v_subtotal, 'total', v_total);
END;
$$;

-- 1c. Drop the fee function and the column itself.
DROP FUNCTION IF EXISTS public.compute_convenience_fee(numeric);
ALTER TABLE public.bills DROP COLUMN IF EXISTS convenience_fee;

-- ────────────────────────────────────────────────────────────
-- 2. DROP LEGACY TABLES + AUTH HOOK
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.venue_staff CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ────────────────────────────────────────────────────────────
-- 3. REBUILD HELPERS AGAINST CURRENT TABLES
--    (staff / customer_profiles replace profiles / venue_staff)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_venue_by_staff_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT s.venue_id, s.role, row_to_json(v.*)::jsonb AS venue
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
        UNION ALL
        SELECT 1 FROM public.customer_profiles
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
    ) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 4. VERIFICATION (run these after the script above)
-- ────────────────────────────────────────────────────────────

-- Should return 0 rows (fee is gone):
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'convenience_fee';

-- Should return 0 rows (legacy functions gone):
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('compute_convenience_fee', 'handle_new_user');

-- Should return 0 rows (legacy tables gone):
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('profiles', 'venue_staff');

-- Sanity: current bills show total = subtotal + service_charge + vat
SELECT id, subtotal, service_charge, vat, total,
       CASE WHEN total = subtotal + service_charge + vat THEN 'OK' ELSE 'MISMATCH' END AS check
FROM public.bills ORDER BY created_at DESC LIMIT 10;
