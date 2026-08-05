-- ═══════════════════════════════════════════════════════════════════
-- STAFF EDITING + PAY MODEL — managers can edit staff info, and each
-- staff member is hourly or salaried (the payroll initiation can hook
-- onto this later).
--
--   1. staff:  + pay_model ('hourly'|'salary', default hourly)
--              + salary_amount (nullable)
--   2. staff_list:  returns pay_model + salary_amount
--   3. create_staff: accepts p_pay_model + p_salary_amount
--   4. update_staff: NEW owner-only RPC — edit role, email, hourly
--      rate, pay model, salary, max tables, area, active. NULL params
--      keep the current value.
--
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR. Idempotent.
-- Mirrored in supabase/01-schema-and-logic.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columns ─────────────────────────────────────────────────────
ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS pay_model text NOT NULL DEFAULT 'hourly'
        CHECK (pay_model IN ('hourly', 'salary')),
    ADD COLUMN IF NOT EXISTS salary_amount numeric(10,2);

-- ── 2. staff_list (return type changed → drop first) ───────────────
DROP FUNCTION IF EXISTS public.staff_list(uuid);
CREATE OR REPLACE FUNCTION public.staff_list(p_venue_id uuid)
RETURNS TABLE(
    id uuid, name text, phone text, email text, role text,
    is_active boolean, pin_set boolean, max_tables int,
    area_assignment text, hourly_rate numeric, pay_model text,
    salary_amount numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active,
           false AS pin_set, s.max_tables, s.area_assignment,
           s.hourly_rate, s.pay_model, s.salary_amount, s.created_at
    FROM public.staff s
    WHERE s.venue_id = p_venue_id
      AND public.is_venue_member(p_venue_id)
    ORDER BY s.name;
$$;
GRANT EXECUTE ON FUNCTION public.staff_list(uuid) TO anon, authenticated, service_role;

-- ── 3. create_staff (signature changed → drop old first) ───────────
DROP FUNCTION IF EXISTS public.create_staff(
    uuid, text, text, text, text, numeric, int, text
);
CREATE OR REPLACE FUNCTION public.create_staff(
    p_venue_id uuid,
    p_name text,
    p_phone text,
    p_role text,
    p_email text DEFAULT NULL,
    p_hourly_rate numeric DEFAULT 0,
    p_max_tables int DEFAULT 6,
    p_area_assignment text DEFAULT NULL,
    p_pay_model text DEFAULT 'hourly',
    p_salary_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_owner uuid;
    v_new_id uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM public.venues WHERE id = p_venue_id;
    IF v_owner IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
    END IF;
    IF p_role NOT IN ('owner', 'manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
    END IF;
    IF p_pay_model NOT IN ('hourly', 'salary') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_pay_model');
    END IF;
    IF EXISTS (SELECT 1 FROM public.staff WHERE venue_id = p_venue_id AND phone = p_phone) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'phone_exists');
    END IF;

    INSERT INTO public.staff (
        venue_id, name, phone, email, role, is_active,
        max_tables, area_assignment, hourly_rate, pay_model, salary_amount
    )
    VALUES (
        p_venue_id, p_name, p_phone, p_email, p_role, true,
        p_max_tables, p_area_assignment, p_hourly_rate, p_pay_model, p_salary_amount
    )
    RETURNING id INTO v_new_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (p_venue_id, 'staff', 'owner', 'staff_created', 'staff', v_new_id::text,
            jsonb_build_object('role', p_role, 'pay_model', p_pay_model));

    RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_staff(uuid, text, text, text, text, numeric, int, text, text, numeric) TO authenticated;

-- ── 4. update_staff (new) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_staff(
    p_staff_id uuid,
    p_role text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_hourly_rate numeric DEFAULT NULL,
    p_pay_model text DEFAULT NULL,
    p_salary_amount numeric DEFAULT NULL,
    p_max_tables int DEFAULT NULL,
    p_area_assignment text DEFAULT NULL,
    p_is_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_venue_id uuid;
    v_owner uuid;
BEGIN
    SELECT venue_id INTO v_venue_id FROM public.staff WHERE id = p_staff_id;
    IF v_venue_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    SELECT owner_id INTO v_owner FROM public.venues WHERE id = v_venue_id;
    IF v_owner IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
    END IF;
    IF p_role IS NOT NULL AND p_role NOT IN ('owner', 'manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
    END IF;
    IF p_pay_model IS NOT NULL AND p_pay_model NOT IN ('hourly', 'salary') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_pay_model');
    END IF;

    UPDATE public.staff
    SET role = COALESCE(p_role, role),
        email = COALESCE(p_email, email),
        hourly_rate = COALESCE(p_hourly_rate, hourly_rate),
        pay_model = COALESCE(p_pay_model, pay_model),
        salary_amount = COALESCE(p_salary_amount, salary_amount),
        max_tables = COALESCE(p_max_tables, max_tables),
        area_assignment = COALESCE(p_area_assignment, area_assignment),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_staff_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_venue_id, 'staff', 'owner', 'staff_updated', 'staff', p_staff_id::text,
            jsonb_build_object('role', p_role, 'pay_model', p_pay_model, 'hourly_rate', p_hourly_rate,
                               'salary_amount', p_salary_amount));

    RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_staff(uuid, text, text, numeric, text, numeric, int, text, boolean) TO authenticated;