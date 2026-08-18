-- ═══════════════════════════════════════════════════════════════════
-- AUTH: VENDLY / ROOMATE-LINK PROVEN PATTERN — canonical phone gate
--
-- Why Vendly's is_store_member() never 403s:
--   • Phones are NORMALISED to +233XXXXXXXXX when written (seed uses
--     normalise_phone at insert).
--   • The gate reads the phone the client actually typed at signup
--     (raw_user_meta_data->>'phone' FIRST, auth.users.phone second).
--   • Membership is an EXACT match on the canonical form — no sloppy
--     substring matching inside RLS, no format drift possible.
--
-- Bysen drifted from this: staff/venue phones were stored in whatever
-- format the manager typed, while GoTrue stores the canonical form —
-- so the gate either needed last-9 trickery or 403'd. This migration
-- restores the battle-tested shape:
--
--   1. Backfill staff.phone + venues.phone → canonical +233… (idempotent)
--   2. is_venue_member(): owner-by-id → metadata phone → confirmed
--      phone column → canonical exact match on staff + venue phone.
--
-- RUN ONCE IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- Mirrored in supabase/01-schema-and-logic.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Backfill: canonical +233XXXXXXXXX everywhere ────────────────
UPDATE public.staff
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

UPDATE public.venues
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

-- ── 2. Membership gate — Vendly shape, canonical exact match ───────
CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_phone text;
BEGIN
    IF target_venue_id IS NULL THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.venues WHERE id = target_venue_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    -- 1st: the phone the client typed at signup (already normalised
    -- client-side to +233…, stored in raw_user_meta_data).
    SELECT raw_user_meta_data->>'phone' INTO user_phone
    FROM auth.users WHERE id = auth.uid();
    -- 2nd: the confirmed phone GoTrue keeps in the phone column.
    IF user_phone IS NULL OR user_phone = '' THEN
        SELECT u.phone INTO user_phone FROM auth.users u WHERE u.id = auth.uid();
    END IF;
    IF user_phone IS NULL OR user_phone = '' THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id
          AND public.normalise_phone(phone) = public.normalise_phone(user_phone)
          AND is_active = true
    ) OR EXISTS (
        -- Owners signing in with the venue's own phone (their number
        -- listed on the venue record) pass the gate too.
        SELECT 1 FROM public.venues
        WHERE id = target_venue_id
          AND public.normalise_phone(phone) = public.normalise_phone(user_phone)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_venue_member(uuid) TO anon, authenticated, service_role;
