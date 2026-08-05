-- Fix for the 403 Forbidden infinite recursion on public.staff
-- This RPC securely bypasses RLS to fetch the staff profile using their phone number

CREATE OR REPLACE FUNCTION public.get_staff_profile_by_phone(p_phone text)
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
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
