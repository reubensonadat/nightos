-- ================================================================
-- EMERGENCY FIX: Recreate the three staff auth functions.
-- Paste ALL of this into Supabase SQL Editor and click Run.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Normaliser (safe to re-run)
CREATE OR REPLACE FUNCTION public.normalise_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT CASE
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^233[0-9]{9}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^0[0-9]{9}$'
      THEN '+233' || substring(regexp_replace(p_phone, '[^0-9]', '', 'g') FROM 2)
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{9}$'
      THEN '+233' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE p_phone
  END;
$$;

-- Normalise all staff phones to +233 format
UPDATE public.staff
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

-- ── staff_lookup ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_lookup(p_phone text)
RETURNS TABLE(
    id uuid, name text, role text,
    venue_id uuid, venue_name text, venue_slug text, pin_set boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.role, v.id, v.name, v.slug,
           s.pin_hash IS NOT NULL
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.phone = public.normalise_phone(p_phone)
      AND s.is_active = true
      AND v.is_active = true
    LIMIT 1;
$$;

-- ── set_staff_pin ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_phone text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated boolean;
BEGIN
    IF p_pin !~ '^[0-9]{4,6}$' THEN RETURN false; END IF;
    UPDATE public.staff
    SET pin_hash = crypt(p_pin, gen_salt('bf'))
    WHERE phone     = public.normalise_phone(p_phone)
      AND is_active = true
      AND pin_hash  IS NULL;
    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

-- ── staff_sign_in ─────────────────────────────────────────────────
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
    WHERE phone = public.normalise_phone(p_phone)
      AND is_active = true
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

-- ── VERIFY (run these after) ──────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('normalise_phone','staff_lookup','set_staff_pin','staff_sign_in');
-- Should return 4 rows.
