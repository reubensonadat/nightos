-- ═════════════════════════════════════════════════════════════════════════════
-- 08 — Global Staff Phone Uniqueness & Cross-Venue Enrollment Guard
-- 
-- Why:
-- 1. Prevents one phone number from being enrolled across multiple venues.
-- 2. Eliminates login ambiguity (which venue does a staff member belong to?).
-- 3. Provides clear feedback if a number is already registered at Venue A vs Venue B.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Phone availability check RPC
CREATE OR REPLACE FUNCTION public.check_staff_phone_availability(
    p_phone text,
    p_venue_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_norm_phone text;
    v_existing record;
BEGIN
    v_norm_phone := RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9);
    IF v_norm_phone IS NULL OR length(v_norm_phone) < 9 THEN
        RETURN jsonb_build_object('available', false, 'reason', 'invalid_phone', 'message', 'Please enter a valid 9 or 10 digit Ghana phone number.');
    END IF;

    -- Check if phone exists in active staff anywhere
    SELECT s.id, s.venue_id, s.name as staff_name, s.role as staff_role, v.name as venue_name
    INTO v_existing
    FROM public.staff s
    LEFT JOIN public.venues v ON v.id = s.venue_id
    WHERE RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = v_norm_phone
      AND s.is_active = true
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.venue_id = p_venue_id THEN
            RETURN jsonb_build_object(
                'available', false,
                'reason', 'same_venue',
                'venue_name', v_existing.venue_name,
                'staff_name', v_existing.staff_name,
                'message', 'This phone number is already enrolled on your staff roster.'
            );
        ELSE
            RETURN jsonb_build_object(
                'available', false,
                'reason', 'other_venue',
                'venue_name', COALESCE(v_existing.venue_name, 'another venue'),
                'staff_name', v_existing.staff_name,
                'message', format('This phone number is already registered at "%s". A staff member cannot work across multiple venues simultaneously.', COALESCE(v_existing.venue_name, 'another venue'))
            );
        END IF;
    END IF;

    -- Check if phone is registered as owner of another venue
    SELECT v.id, v.name INTO v_existing
    FROM public.venues v
    WHERE RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9) = v_norm_phone
      AND v.id != p_venue_id
      AND v.is_active = true
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'available', false,
            'reason', 'venue_owner',
            'venue_name', v_existing.name,
            'message', format('This phone number is registered as the owner of "%s".', v_existing.name)
        );
    END IF;

    RETURN jsonb_build_object('available', true, 'message', 'Phone number is available for enrollment.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_staff_phone_availability(text, uuid) TO authenticated, anon;


-- 2. Enhanced create_staff RPC with cross-venue guard
CREATE OR REPLACE FUNCTION public.create_staff(
    p_venue_id uuid,
    p_name text,
    p_phone text,
    p_role text,
    p_email text DEFAULT NULL,
    p_hourly_rate numeric DEFAULT 0,
    p_max_tables integer DEFAULT 6,
    p_area_assignment text DEFAULT NULL,
    p_pay_model text DEFAULT 'hourly',
    p_salary_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_norm_phone text;
    v_check jsonb;
    v_new_id uuid;
BEGIN
    v_norm_phone := RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9);
    IF v_norm_phone IS NULL OR length(v_norm_phone) < 9 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone', 'message', 'Invalid phone number format.');
    END IF;

    -- Run availability check
    v_check := public.check_staff_phone_availability(p_phone, p_venue_id);
    IF (v_check->>'available')::boolean IS FALSE THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', v_check->>'reason',
            'venue_name', v_check->>'venue_name',
            'message', v_check->>'message'
        );
    END IF;

    -- Clean up any deactivated placeholder rows with the same phone in this venue
    DELETE FROM public.staff
    WHERE venue_id = p_venue_id
      AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = v_norm_phone
      AND is_active = false;

    -- Insert new staff member
    INSERT INTO public.staff (
        venue_id, name, phone, email, role, hourly_rate, max_tables,
        area_assignment, pay_model, salary_amount, is_active
    ) VALUES (
        p_venue_id, p_name, p_phone, p_email, p_role, p_hourly_rate, p_max_tables,
        p_area_assignment, p_pay_model, p_salary_amount, true
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff(uuid, text, text, text, text, numeric, integer, text, text, numeric) TO authenticated, anon;


-- 3. Physically Enforce at the Database Engine Level
-- Deduplicate any existing active staff rows with identical phones before creating index
WITH ranked_staff AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY public.normalise_phone(phone)
               ORDER BY created_at DESC, id DESC
           ) as rn
    FROM public.staff
    WHERE is_active = true 
      AND phone IS NOT NULL 
      AND length(public.normalise_phone(phone)) >= 9
)
UPDATE public.staff
SET is_active = false
WHERE id IN (SELECT id FROM ranked_staff WHERE rn > 1);

-- Create partial unique index: ensures no two active staff across ALL venues can have the same normalized phone
DROP INDEX IF EXISTS idx_staff_active_phone_unique;
CREATE UNIQUE INDEX idx_staff_active_phone_unique
ON public.staff (public.normalise_phone(phone))
WHERE is_active = true AND phone IS NOT NULL AND length(public.normalise_phone(phone)) >= 9;

