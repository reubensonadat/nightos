-- ============================================================
-- 11-fix-venue-phones-and-staff-isolation.sql
-- Fixes:
-- 1. Detaches owner phone +233541651298 from demo venue 'velvet-lounge'
--    and sets Velvet Lounge to a neutral demo phone.
-- 2. Sets Memories Night Club phone to +233541651298.
-- 3. Deactivates duplicate test staff member in Velvet Lounge.
-- 4. Updates get_venue_by_staff_phone, get_staff_profile_by_phone,
--    venue_by_phone, and resolve_login to support target_venue_slug
--    and prioritize real venues over demo venues.
-- ============================================================

-- 1. Disassociate real owner phone from Velvet Lounge
UPDATE public.venues
SET phone = '+233501234567'
WHERE slug = 'velvet-lounge';

-- 2. Assign phone to Memories Night Club
UPDATE public.venues
SET phone = '+233541651298'
WHERE slug = 'memories-night-club';

-- 3. Deactivate rogue duplicate staff row in Velvet Lounge
UPDATE public.staff
SET is_active = false
WHERE phone LIKE '%541651298%'
  AND venue_id = 'a0000000-0000-0000-0000-000000000001';

-- 4. Enhance venue_by_phone to accept optional venue filter & prioritize real venues
CREATE OR REPLACE FUNCTION public.venue_by_phone(p_phone text, p_venue_slug text DEFAULT NULL)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
    SELECT v.id, 'owner'::text, row_to_json(v.*)::jsonb AS venue
    FROM public.venues v
    WHERE RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND (p_venue_slug IS NULL OR v.slug = p_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, v.created_at DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.venue_by_phone(text, text) TO anon, authenticated, service_role;

-- 5. Enhance get_venue_by_staff_phone
CREATE OR REPLACE FUNCTION public.get_venue_by_staff_phone(p_phone text, p_venue_slug text DEFAULT NULL)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT s.venue_id, s.role, row_to_json(v.*)::jsonb AS venue
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND s.is_active = true
      AND (p_venue_slug IS NULL OR v.slug = p_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_venue_by_staff_phone(text, text) TO anon, authenticated, service_role;

-- 6. Enhance get_staff_profile_by_phone
CREATE OR REPLACE FUNCTION public.get_staff_profile_by_phone(p_phone text, p_venue_slug text DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    name text,
    role text,
    max_tables integer,
    area_assignment text,
    venue_id uuid,
    venue_name text,
    venue_slug text
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.role, s.max_tables, s.area_assignment,
           v.id AS venue_id, v.name AS venue_name, v.slug AS venue_slug
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND s.is_active = true
      AND (p_venue_slug IS NULL OR v.slug = p_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_staff_profile_by_phone(text, text) TO anon, authenticated, service_role;

-- 7. Enhance resolve_login
CREATE OR REPLACE FUNCTION public.resolve_login(identifier text, target_venue_slug text DEFAULT NULL)
RETURNS TABLE (role text, venue_id uuid, venue_slug text, venue_name text, staff_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_norm text := public.normalise_phone(identifier);
BEGIN
    -- Check Owner by phone
    RETURN QUERY
    SELECT 'owner'::text, v.id, v.slug, v.name, NULL::uuid
    FROM public.venues v
    WHERE (
        RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(identifier, '\D', '', 'g'), 9)
        OR public.normalise_phone(v.phone) = v_norm
    )
      AND v.is_active = true
      AND (target_venue_slug IS NULL OR v.slug = target_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, v.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Check Staff by phone
    RETURN QUERY
    SELECT s.role::text, v.id, v.slug, v.name, s.id
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE (
        RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(identifier, '\D', '', 'g'), 9)
        OR public.normalise_phone(s.phone) = v_norm
    )
      AND s.is_active = true AND v.is_active = true
      AND (target_venue_slug IS NULL OR v.slug = target_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, s.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Check by email
    RETURN QUERY
    SELECT s.role::text, v.id, v.slug, v.name, s.id
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE LOWER(s.email) = LOWER(identifier)
      AND s.is_active = true AND v.is_active = true
      AND (target_venue_slug IS NULL OR v.slug = target_venue_slug)
    ORDER BY CASE WHEN v.slug = 'velvet-lounge' THEN 1 ELSE 0 END, s.created_at DESC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login(text, text) TO anon, authenticated, service_role;
