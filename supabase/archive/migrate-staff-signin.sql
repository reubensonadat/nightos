-- ═══════════════════════════════════════════════════════════════
-- NIGHTOS — DEPLOY MISSING STAFF PIN FUNCTIONS (LIVE DB FIX)
-- Why: `staff_sign_in` + `set_staff_pin` were never created on the
-- live database, so every staff screen shows "Wrong phone or PIN."
-- (The app calls `staff_sign_in` → PostgREST 404 → generic error.)
-- Safe to re-run (idempotent). Paste in Supabase SQL Editor → Run.
-- Verify afterwards:
--   SELECT public.staff_sign_in('0240000001', '1234');
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First-time PIN setup. Only works if the staff row exists, is active,
-- and has NO pin yet (so no one can overwrite an existing PIN).
-- PIN must be 4–6 digits.
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_phone text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated boolean;
BEGIN
    IF p_pin !~ '^[0-9]{4,6}$' THEN
        RETURN false;
    END IF;
    UPDATE public.staff
    SET pin_hash = crypt(p_pin, gen_salt('bf'))
    WHERE phone = p_phone AND is_active = true AND pin_hash IS NULL;
    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

-- Sign in with phone + own PIN. Returns the staff member + their venue.
CREATE OR REPLACE FUNCTION public.staff_sign_in(p_phone text, p_pin text)
RETURNS TABLE(
    id uuid, name text, role text,
    venue_id uuid, venue_name text, venue_slug text,
    area_assignment text, max_tables int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_staff
    FROM public.staff
    WHERE phone = p_phone AND is_active = true
    LIMIT 1;

    IF NOT FOUND OR v_staff.pin_hash IS NULL
       OR v_staff.pin_hash <> crypt(p_pin, v_staff.pin_hash) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v_staff.id, v_staff.name, v_staff.role,
           v.id, v.name, v.slug,
           v_staff.area_assignment, v_staff.max_tables
    FROM public.venues v
    WHERE v.id = v_staff.venue_id AND v.is_active = true;
END;
$$;
