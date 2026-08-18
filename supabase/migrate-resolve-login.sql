-- ============================================================
-- resolve_login — central login role resolution (AUTH Batch C)
-- ------------------------------------------------------------
-- One RPC answers "who is this identifier?" after credentials
-- verify. The client never sees a role picker; this decides the
-- destination dashboard.
--
--   * owner   : the signed-in auth user owns a venue
--   * staff   : staff row matches by email or normalised phone
--   * none    : nothing found -> no-account (signup) flow
--
-- Pure read, idempotent, SECURITY DEFINER (bypasses RLS on
-- public.staff, same trick as get_staff_profile_by_phone).
-- ============================================================

DROP FUNCTION IF EXISTS public.resolve_login(identifier text);

CREATE OR REPLACE FUNCTION public.resolve_login(identifier text)
RETURNS TABLE (
    role       text,
    venue_id   uuid,
    venue_name text,
    venue_slug text,
    staff_id   uuid,
    name       text
) AS $$
DECLARE
    v_identifier text := btrim(identifier);
    v_uid        uuid := auth.uid();
BEGIN
    -- 1 · Owner: any venue owned by the signed-in user.
    IF v_uid IS NOT NULL THEN
        RETURN QUERY
        SELECT 'owner'::text, v.id, v.name, v.slug, NULL::uuid, NULL::text
        FROM public.venues v
        WHERE v.owner_id = v_uid
          AND v.is_active = true
        LIMIT 1;
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- 2 · Staff: match by email or normalised phone.
    RETURN QUERY
    SELECT s.role, v.id, v.name, v.slug, s.id, s.name
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.is_active = true
      AND (
            v_identifier LIKE '%@%'
                AND lower(btrim(s.email)) = lower(v_identifier)
            OR
            v_identifier NOT LIKE '%@%'
                AND RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9)
                    = RIGHT(REGEXP_REPLACE(v_identifier, '\D', '', 'g'), 9)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anyone with a session may resolve their own identity.
GRANT EXECUTE ON FUNCTION public.resolve_login(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login(text) TO service_role;

COMMENT ON FUNCTION public.resolve_login(text) IS
    'Central login role resolution: owner (by auth.uid) or staff (by email/phone). Pure read, idempotent.';
