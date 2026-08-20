-- ═══════════════════════════════════════════════════════════════════
-- FIX: MANAGER CANNOT SEE STAFF — venue membership identity + staff_list
--
-- Root cause: is_venue_member() looked for the phone in
-- raw_user_meta_data->>'phone', but phone-OTP sign-in stores the
-- confirmed phone in auth.users.phone (a real column). So active staff
-- failed the membership test and RLS hid the rows the manager dashboard
-- reads.
--
-- Also: staff_list is recreated to allow ANY active venue member
-- (owner, manager, supervisor, kitchen, bar, cashier, waiter) to read
-- the list — not just the owner.
--
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR. Idempotent.
-- Mirrored in supabase/01-schema-and-logic.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Membership: owner by id, staff by phone column ──────────────
CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_phone text;
BEGIN
    IF target_venue_id IS NULL THEN
        RETURN false;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.venues
        WHERE id = target_venue_id AND owner_id = auth.uid()
    ) THEN
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
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id
          AND phone = user_phone
          AND is_active = true
    );
END;
$$;

-- ── 2. staff_list: any active venue member can read it ─────────────
-- DROP first: the live DB has an older staff_list with a different
-- OUT-parameter row type, and CREATE OR REPLACE cannot change it (42P13).
DROP FUNCTION IF EXISTS public.staff_list(uuid);
CREATE OR REPLACE FUNCTION public.staff_list(p_venue_id uuid)
RETURNS TABLE(
    id uuid, name text, phone text, email text, role text,
    is_active boolean, pin_set boolean, max_tables int,
    area_assignment text, hourly_rate numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active,
           false AS pin_set, s.max_tables, s.area_assignment,
           s.hourly_rate, s.created_at
    FROM public.staff s
    WHERE s.venue_id = p_venue_id
      AND public.is_venue_member(p_venue_id)
    ORDER BY s.name;
$$;

GRANT EXECUTE ON FUNCTION public.is_venue_member(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_list(uuid) TO anon, authenticated, service_role;