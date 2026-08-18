-- ═══════════════════════════════════════════════════════════════════
-- FIX: PHONE SIGN-IN 403s + "SIGNED IN THEN SIGNED OUT" BOUNCE
--
-- Root cause #1 (403s): is_venue_member() compared staff.phone to
-- auth.users.phone EXACTLY, but staff rows are stored like "0241234567"
-- while phone-OTP sign-in puts "+233241234567" in auth.users.phone.
-- Every other function in the schema (get_venue_by_staff_phone,
-- get_staff_profile_by_phone, check_phone_exists) matches on the
-- LAST-9 DIGITS, so role resolution succeeded via RPC while every
-- RLS-guarded table query (staff, staff_shifts, tables, bills, ...)
-- returned 403. The manager dashboard was broken for phone logins.
--
-- Root cause #2 (bounce): the OTP flow signed the user IN (creating a
-- phantom Supabase auth user), and when the phone didn't resolve to an
-- active staff row the app immediately called signOut() — "signed in
-- and signed out automatically". Owners signing in with the venue's
-- phone number got bounced even though they own the venue.
--
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR. Idempotent.
-- Mirrored in supabase/01-schema-and-logic.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Membership: last-9-digit phone comparison ───────────────────
CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_phone text;
    user_phone9 text;
BEGIN
    IF target_venue_id IS NULL THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.venues WHERE id = target_venue_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    SELECT u.phone INTO user_phone FROM auth.users u WHERE u.id = auth.uid();
    IF user_phone IS NULL OR user_phone = '' THEN
        -- Fallback for signups that stored the phone in metadata.
        SELECT raw_user_meta_data->>'phone' INTO user_phone
        FROM auth.users WHERE id = auth.uid();
    END IF;
    IF user_phone IS NULL OR user_phone = '' THEN
        RETURN false;
    END IF;
    user_phone9 := RIGHT(REGEXP_REPLACE(user_phone, '\D', '', 'g'), 9);
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id
          AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = user_phone9
          AND is_active = true
    ) OR EXISTS (
        -- Owners who sign in with the venue's own phone number (or their
        -- number listed on the venue) pass the membership gate too —
        -- otherwise role resolution says "owner" but every table query 403s.
        SELECT 1 FROM public.venues
        WHERE id = target_venue_id
          AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = user_phone9
    );
END;
$$;

-- ── 2. Owner-by-venue-phone: owners who sign in with their venue's
-- contact phone (or their own number listed on the venue) resolve to
-- owner instead of being bounced. Returns the full venue row like
-- get_venue_by_staff_phone does for staff. ──────────────────────────
CREATE OR REPLACE FUNCTION public.venue_by_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT v.id, 'owner'::text, row_to_json(v.*)::jsonb AS venue
    FROM public.venues v
    WHERE RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9)
        = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND v.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_venue_member(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.venue_by_phone(text) TO anon, authenticated, service_role;
