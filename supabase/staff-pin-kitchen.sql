-- ═══════════════════════════════════════════════════════════════
-- NIGHTOS — STAFF OWN PIN + REAL ORDER STATUS + KITCHEN READS
-- Run this ONCE in Supabase SQL Editor (copy all, paste, Run).
-- Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════
-- 1. Staff set their OWN PIN (hashed in the DB, NOT Supabase Auth,
--    so waiters/bar/kitchen never count as monthly users).
-- 2. Kitchen display can read active orders and move their status.
-- 3. Customers see the REAL status of their order (no fake timers).

-- ── 1. PIN STORAGE ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin_hash text;

-- Hash the plaintext pins already in the DB (e.g. the seed's 1234)
UPDATE public.staff
SET pin_hash = crypt(pin, gen_salt('bf'))
WHERE pin_hash IS NULL AND pin IS NOT NULL AND pin <> '';

-- Phone lookup — safe, never returns the PIN. Also gives the venue
-- name so staff know which restaurant they are signing into.
CREATE OR REPLACE FUNCTION public.staff_lookup(p_phone text)
RETURNS TABLE(
    id uuid, name text, role text,
    venue_id uuid, venue_name text, venue_slug text, pin_set boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.role, v.id, v.name, v.slug, s.pin_hash IS NOT NULL
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.phone = p_phone
      AND s.is_active = true
      AND v.is_active = true
    LIMIT 1;
$$;

-- First-time PIN setup. Only works if the staff row exists, is active,
-- and has NO pin yet (so no one can overwrite an existing PIN).
-- PIN must be 4–6 digits.
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_phone text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated boolean;
BEGIN
    IF p_pin !~ '^[0-9]{4,6}$' THEN
        RETURN false;
    END IF;
    UPDATE public.staff
    SET pin_hash = crypt(p_pin, gen_salt('bf'))
    WHERE phone = p_phone AND is_active = true AND pin_hash IS NULL;
    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

-- Sign in with phone + own PIN. Returns the staff member + their venue.
CREATE OR REPLACE FUNCTION public.staff_sign_in(p_phone text, p_pin text)
RETURNS TABLE(
    id uuid, name text, role text,
    venue_id uuid, venue_name text, venue_slug text,
    area_assignment text, max_tables int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_staff
    FROM public.staff
    WHERE phone = p_phone AND is_active = true
    LIMIT 1;

    IF NOT FOUND OR v_staff.pin_hash IS NULL
       OR v_staff.pin_hash <> crypt(p_pin, v_staff.pin_hash) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v_staff.id, v_staff.name, v_staff.role,
           v.id, v.name, v.slug,
           v_staff.area_assignment, v_staff.max_tables
    FROM public.venues v
    WHERE v.id = v_staff.venue_id AND v.is_active = true;
END;
$$;

-- ── 2. KITCHEN DISPLAY (active orders only) ─────────────────────
-- Anon can read orders that are still being worked on (not served),
-- their items, the bill/table info, and the waiter names attached to
-- open bills. Served/history orders stay private to the owner.

DROP POLICY IF EXISTS "Kitchen reads active submissions" ON public.order_submissions;
CREATE POLICY "Kitchen reads active submissions" ON public.order_submissions
    FOR SELECT USING (status IN ('pending', 'confirmed', 'preparing', 'ready'));

DROP POLICY IF EXISTS "Kitchen reads order items" ON public.order_items;
CREATE POLICY "Kitchen reads order items" ON public.order_items
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
        )
    );

DROP POLICY IF EXISTS "Kitchen reads bills" ON public.bills;
CREATE POLICY "Kitchen reads bills" ON public.bills
    FOR SELECT USING (
        id IN (
            SELECT bill_id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
        )
    );

DROP POLICY IF EXISTS "Kitchen reads waiter names" ON public.staff;
CREATE POLICY "Kitchen reads waiter names" ON public.staff
    FOR SELECT USING (
        id IN (
            SELECT DISTINCT waiter_id FROM public.bills
            WHERE waiter_id IS NOT NULL AND status IN ('open', 'settling')
        )
    );

-- Status changes are done through this RPC: the staff member must be
-- active and belong to the same venue as the order.
-- NOTE: keep identical to setup-all.sql (B3) — this file is the legacy
-- variant; setup-all.sql must win if both are ever pasted.
CREATE OR REPLACE FUNCTION public.set_order_status(
    p_submission_id uuid, p_status text, p_staff_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_submission public.order_submissions%ROWTYPE;
    v_staff public.staff%ROWTYPE;
BEGIN
    IF p_status NOT IN ('confirmed', 'preparing', 'ready', 'served', 'cancelled') THEN
        RETURN false;
    END IF;

    SELECT * INTO v_submission
    FROM public.order_submissions WHERE id = p_submission_id LIMIT 1;
    IF NOT FOUND THEN RETURN false; END IF;

    IF p_status = 'cancelled' AND v_submission.status IN ('served', 'cancelled') THEN
        RETURN false;
    END IF;

    SELECT * INTO v_staff
    FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_submission.venue_id IS DISTINCT FROM v_staff.venue_id THEN
        RETURN false;
    END IF;

    UPDATE public.order_submissions
    SET status = p_status, updated_at = now()
    WHERE id = p_submission_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_submission.venue_id, 'staff', v_staff.name, 'order_status_' || p_status, 'order_submission', v_submission.id::text,
            jsonb_build_object('from', v_submission.status, 'to', p_status));

    RETURN true;
END;
$$;

-- ── 3. CUSTOMERS SEE REAL ORDER STATUS ─────────────────────────
-- The tracking screen polls the real submission status (via the
-- session token), instead of faking "on its way / served" on timers.

DROP POLICY IF EXISTS "Customers read own submissions" ON public.order_submissions;
CREATE POLICY "Customers read own submissions" ON public.order_submissions
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

DROP POLICY IF EXISTS "Customers read own items" ON public.order_items;
CREATE POLICY "Customers read own items" ON public.order_items
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify with:
--   SELECT name, phone, role, pin_hash IS NOT NULL AS has_pin FROM staff ORDER BY role;
--   SELECT status, count(*) FROM order_submissions GROUP BY status;
--   SELECT public.staff_lookup('0240000001');
-- ═══════════════════════════════════════════════════════════════
