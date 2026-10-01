-- ============================================================
-- 12-fix-ownership-claim.sql
-- Root cause of "waiter login lands on the manager dashboard":
--
-- claim_venue_ownership() had a staff-row FALLBACK: when the logged-in
-- phone matched no venues.phone, it grabbed the venue from the STAFF
-- table and wrote that staff member's auth user id into venues.owner_id.
-- From that moment on, every login resolved the waiter as the venue
-- OWNER (loadUserData step 1: venuesByOwner) → sectorPath('owner')
-- → /manager/ops.
--
-- Fixes:
--   1. Replaces the RPC — ownership can ONLY be claimed when the auth
--      user's phone matches the venue's own phone. No staff fallback.
--   2. Restores the true owner where the venue phone maps to an auth user.
--   3. Clears hijacked owner_id rows whose owner's phone matches a STAFF
--      row of that venue but NOT the venue phone (the fallback signature).
--
-- Run in the Supabase SQL Editor (safe to re-run; idempotent).
-- ============================================================

-- ── 1. Fixed RPC ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_venue_ownership()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_phone text;
    v_venue_id uuid;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    v_phone := public.current_user_phone();
    IF v_phone IS NULL OR v_phone = '' THEN
        RETURN NULL;
    END IF;

    -- Ownership claim is ONLY valid on an exact venue-phone match.
    -- NEVER fall back to staff rows: staff must never become owners.
    SELECT id INTO v_venue_id
    FROM public.venues
    WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(v_phone, '\D', '', 'g'), 9)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_venue_id IS NOT NULL THEN
        UPDATE public.venues
        SET owner_id = v_user_id
        WHERE id = v_venue_id;

        UPDATE public.staff
        SET is_active = true
        WHERE venue_id = v_venue_id
          AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(v_phone, '\D', '', 'g'), 9);

        RETURN v_venue_id;
    END IF;

    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_venue_ownership() TO authenticated, anon;

-- ── 2. Restore true owners (venue phone → auth user) ──────────
WITH venue_owner_phone AS (
    SELECT v.id AS vid, au.id AS uid
    FROM public.venues v
    JOIN auth.users au
      ON au.phone IS NOT NULL
     AND RIGHT(REGEXP_REPLACE(au.phone, '\D', '', 'g'), 9)
       = RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9)
)
UPDATE public.venues v
SET owner_id = vo.uid
FROM venue_owner_phone vo
WHERE v.id = vo.vid
  AND v.owner_id IS DISTINCT FROM vo.uid;

-- ── 3. Clear hijacked owner_id (staff-fallback signature) ─────
-- (All table cross-references live in WHERE: the UPDATE target cannot be
--  referenced from the FROM join clause in PostgreSQL.)
WITH owner_phone AS (
    SELECT au.id AS uid,
           RIGHT(REGEXP_REPLACE(au.phone, '\D', '', 'g'), 9) AS p9
    FROM auth.users au
    WHERE au.phone IS NOT NULL
)
UPDATE public.venues v
SET owner_id = NULL
FROM owner_phone op, public.staff s
WHERE s.venue_id = v.id
  AND RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = op.p9
  AND v.owner_id = op.uid
  AND COALESCE(RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9), '') <> op.p9;
