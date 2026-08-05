-- ================================================================
-- NightOS — PHONE NORMALISATION FIX FOR STAFF AUTH
-- Root cause: staff phones may be stored in different formats
-- (0241234567 / 233241234567 / +233241234567). The app always sends
-- +233XXXXXXXXX, but the DB does an exact WHERE phone = p_phone match,
-- so zero rows are found and PIN setup/sign-in always fails.
--
-- This script adds a normalise_phone() helper and rebuilds all three
-- staff auth RPCs to normalise both sides of the comparison.
-- Safe to re-run (idempotent). Run in Supabase SQL Editor.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Helper: normalise any Ghana phone to +233XXXXXXXXX ───────────
-- Handles: 024…, 233…, +233…, spaces, dashes.
CREATE OR REPLACE FUNCTION public.normalise_phone(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT CASE
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^233[0-9]{9}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^0[0-9]{9}$'
      THEN '+233' || substring(regexp_replace(p_phone, '[^0-9]', '', 'g') FROM 2)
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{9}$'
      THEN '+233' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE p_phone  -- pass through unknown formats unchanged
  END;
$$;

-- Also normalise all existing phone numbers in the staff table to
-- the +233XXXXXXXXX format so future lookups always match.
UPDATE public.staff
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL
  AND phone NOT LIKE '+233%';

-- ── staff_lookup ─────────────────────────────────────────────────
-- Now normalises the input phone before comparing.
DROP FUNCTION IF EXISTS public.staff_lookup(p_phone text);
CREATE FUNCTION public.staff_lookup(p_phone text)
RETURNS TABLE(
    id uuid, name text, role text,
    venue_id uuid, venue_name text, venue_slug text, pin_set boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.role, v.id, v.name, v.slug, s.pin_hash IS NOT NULL
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.phone = public.normalise_phone(p_phone)
      AND s.is_active = true
      AND v.is_active = true
    LIMIT 1;
$$;

-- ── set_staff_pin ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_staff_pin(p_phone text, p_pin text);
CREATE FUNCTION public.set_staff_pin(p_phone text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated boolean;
BEGIN
    -- Validate PIN format
    IF p_pin !~ '^[0-9]{4,6}$' THEN
        RETURN false;
    END IF;
    -- Update using normalised phone — only if no PIN set yet
    UPDATE public.staff
    SET pin_hash = crypt(p_pin, gen_salt('bf'))
    WHERE phone = public.normalise_phone(p_phone)
      AND is_active = true
      AND pin_hash IS NULL;
    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

-- ── staff_sign_in ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.staff_sign_in(p_phone text, p_pin text);
CREATE FUNCTION public.staff_sign_in(p_phone text, p_pin text)
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
        RETURN;  -- returns empty set = failed auth
    END IF;

    RETURN QUERY
    SELECT v_staff.id, v_staff.name, v_staff.role,
           v.id, v.name, v.slug,
           v_staff.area_assignment, v_staff.max_tables
    FROM public.venues v
    WHERE v.id = v_staff.venue_id AND v.is_active = true;
END;
$$;

-- ── VERIFY ───────────────────────────────────────────────────────
-- Check that a staff phone is now in +233 format:
--   SELECT id, name, phone FROM public.staff LIMIT 10;
--
-- Test the normaliser:
--   SELECT public.normalise_phone('0241234567');  -- → +233241234567
--   SELECT public.normalise_phone('+233241234567'); -- → +233241234567
--
-- Test the lookup (replace with a real staff phone):
--   SELECT * FROM public.staff_lookup('0241234567');
-- ─────────────────────────────────────────────────────────────────
