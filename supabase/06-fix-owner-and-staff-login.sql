-- ═════════════════════════════════════════════════════════════════════════════
-- 06 — Fix Venue Ownership, Activate Staff & Auto-Claim RPC
-- 
-- Why:
-- 1. Updates Velvet Lounge phone to +233541651298 and assigns owner_id.
-- 2. Reactivates staff row for +233541651298 as manager/owner.
-- 3. Creates claim_venue_ownership() so any login from the owner's phone
--    automatically links owner_id in Supabase, preventing the /setup bounce.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Set Velvet Lounge contact phone to the owner's phone
UPDATE public.venues
SET phone = '+233541651298',
    is_active = true
WHERE slug = 'velvet-lounge';

-- 2. Link owner_id to the auth.users account matching 541651298
UPDATE public.venues v
SET owner_id = u.id
FROM (
    SELECT id FROM auth.users
    WHERE (phone LIKE '%541651298')
       OR (raw_user_meta_data->>'phone' LIKE '%541651298')
    ORDER BY created_at DESC
    LIMIT 1
) u
WHERE v.slug = 'velvet-lounge'
  AND (v.owner_id IS NULL OR v.owner_id IS DISTINCT FROM u.id);

-- 3. Reactivate staff member for +233541651298
UPDATE public.staff
SET is_active = true,
    role = 'manager'
WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = '541651298';

-- Also ensure other venue managers are active
UPDATE public.staff
SET is_active = true
WHERE role = 'manager' AND venue_id = 'a0000000-0000-0000-0000-000000000001';

-- Clean up any temporary test staff
DELETE FROM public.staff WHERE phone = '+233541651299';

-- 4. Auto-Claim Venue Ownership RPC (Runs on login to guarantee owner_id is synced)
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

    -- Get normalized phone of current user
    v_phone := public.current_user_phone();
    IF v_phone IS NULL OR v_phone = '' THEN
        RETURN NULL;
    END IF;

    -- Find matching venue by owner phone
    SELECT id INTO v_venue_id
    FROM public.venues
    WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(v_phone, '\D', '', 'g'), 9)
    ORDER BY created_at ASC
    LIMIT 1;

    -- Fallback: if only 1 venue exists or velvet-lounge matches staff phone
    IF v_venue_id IS NULL THEN
        SELECT venue_id INTO v_venue_id
        FROM public.staff
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(v_phone, '\D', '', 'g'), 9)
        LIMIT 1;
    END IF;

    IF v_venue_id IS NOT NULL THEN
        -- Sync owner_id to current auth session
        UPDATE public.venues
        SET owner_id = v_user_id
        WHERE id = v_venue_id;

        -- Ensure staff member row is active
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
