-- ═══════════════════════════════════════════════════════════════
-- BYSEN — COMPLETE SETUP (ONE-TIME PASTE)
-- Copy ALL of this into Supabase SQL Editor and click Run.
-- Safe to re-run (idempotent).
--
-- Contains:
--   A. Staff own-PIN auth + kitchen reads + customer real status
--   B. Platform fees (cash), waiter-only cancellation, 20-min expiry
--   C. Manager dashboard RPCs (outstanding balance, floor, bills)
--   C3. Table operations (transfer / merge / split)
--   D. Realtime publication for the live-updating screens
--   E. Payment hardening: unique references, bill auto-close trigger
--   F. Manager write policies (inventory, CRM)
--
-- After running, verify with the queries at the very bottom.
-- ═══════════════════════════════════════════════════════════════

-- ── 0. DROP OLD VARIANTS (idempotent re-runs) ─────────────────
-- Postgres refuses CREATE OR REPLACE when a function's return type
-- changed (e.g. an older script defined open_bill_overview with OUT
-- params). Dropping first makes every re-run work. Each function is
-- fully recreated below, so nothing is lost.
DROP FUNCTION IF EXISTS public.staff_lookup(p_phone text);
DROP FUNCTION IF EXISTS public.set_staff_pin(p_phone text, p_pin text);
DROP FUNCTION IF EXISTS public.staff_sign_in(p_phone text, p_pin text);
DROP FUNCTION IF EXISTS public.platform_fee_for(p_amount numeric);
DROP FUNCTION IF EXISTS public.record_cash_payment(p_bill_id uuid, p_amount numeric, p_staff_id uuid, p_payer_name text);
DROP FUNCTION IF EXISTS public.set_order_status(p_submission_id uuid, p_status text, p_staff_id uuid);
DROP FUNCTION IF EXISTS public.expire_stale_sessions();
DROP FUNCTION IF EXISTS public.staff_list(p_venue_id uuid);
DROP FUNCTION IF EXISTS public.create_staff(p_venue_id uuid, p_name text, p_phone text, p_role text, p_email text, p_hourly_rate numeric, p_max_tables int, p_area_assignment text);
DROP FUNCTION IF EXISTS public.set_staff_active(p_staff_id uuid, p_active boolean);
DROP FUNCTION IF EXISTS public.outstanding_balance(p_venue_id uuid);
DROP FUNCTION IF EXISTS public.landed_without_orders(p_venue_id uuid);
DROP FUNCTION IF EXISTS public.open_bill_overview(p_venue_id uuid);
DROP FUNCTION IF EXISTS public.recompute_bill_totals(p_bill_id uuid);
DROP FUNCTION IF EXISTS public.transfer_bill(p_bill_id uuid, p_dest_table_id uuid, p_staff_id uuid);
DROP FUNCTION IF EXISTS public.merge_bills(p_source_bill_id uuid, p_dest_bill_id uuid, p_staff_id uuid);
DROP FUNCTION IF EXISTS public.split_bill(p_bill_id uuid, p_ways int, p_staff_id uuid);
DROP FUNCTION IF EXISTS public.staff_shift_summary(p_staff_id uuid);
DROP FUNCTION IF EXISTS public.reservations_by_phone(p_phone text);

-- ── A0. VENUE OWNER LINK ───────────────────────────────────────
-- Keeps the venue owned by YOUR most recent auth account for the
-- owner phone (0541651298). Re-running this after you sign up is
-- what makes the manager dashboard see everything. Safe to re-run.
UPDATE public.venues v
SET owner_id = u.id
FROM (
    SELECT id FROM auth.users
    WHERE (raw_user_meta_data->>'phone' LIKE '%541651298')
       OR (phone LIKE '%541651298')
    ORDER BY created_at DESC
    LIMIT 1
) u
WHERE v.slug = 'velvet-lounge'
  AND v.owner_id IS DISTINCT FROM u.id;

-- ── A1. PIN STORAGE ────────────────────────────────────────────
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

-- ── A2. KITCHEN DISPLAY (active orders only) ───────────────────
-- 'served'/'cancelled' are included so the waiter's settlement invoice
-- and Current Order tab still show finished items, and so the kitchen
-- board stops showing a ticket once another device marks it served.
DROP POLICY IF EXISTS "Kitchen reads active submissions" ON public.order_submissions;
CREATE POLICY "Kitchen reads active submissions" ON public.order_submissions
    FOR SELECT USING (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'));

DROP POLICY IF EXISTS "Kitchen reads order items" ON public.order_items;
CREATE POLICY "Kitchen reads order items" ON public.order_items
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')
        )
    );

DROP POLICY IF EXISTS "Kitchen reads bills" ON public.bills;
CREATE POLICY "Kitchen reads bills" ON public.bills
    FOR SELECT USING (
        id IN (
            SELECT bill_id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')
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

-- ── A2b. STAFF PLACE ORDERS (own-PIN staff have no Supabase auth) ─
-- Waiter devices insert submissions/items directly (no session token).
-- The check requires the bill to actually exist and still be open, so
-- nothing can be ordered against a paid/closed bill.
DROP POLICY IF EXISTS "Staff place order submissions" ON public.order_submissions;
CREATE POLICY "Staff place order submissions" ON public.order_submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills b
            WHERE b.id = bill_id AND b.status IN ('open', 'settling')
        )
    );

DROP POLICY IF EXISTS "Staff place order items" ON public.order_items;
CREATE POLICY "Staff place order items" ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills b
            WHERE b.id = bill_id AND b.status IN ('open', 'settling')
        )
    );

-- ── A3. CUSTOMERS SEE REAL ORDER STATUS ────────────────────────
DROP POLICY IF EXISTS "Customers read own submissions" ON public.order_submissions;
CREATE POLICY "Customers read own submissions" ON public.order_submissions
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

DROP POLICY IF EXISTS "Customers read own items" ON public.order_items;
CREATE POLICY "Customers read own items" ON public.order_items
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

-- ── B1. PLATFORM FEE ON PAYMENTS ───────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS platform_fee numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS fee_settled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_fee_settled_idx
    ON public.payments (venue_id, fee_settled);

-- Fee formula: 1% of the bill, clamped between 1.00 and 15.00.
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT GREATEST(1.00, LEAST(15.00, ROUND(p_amount * 0.01, 2)));
$$;

-- ── B2. CASH SETTLEMENT (waiter confirms the cash) ─────────────
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_bill_id uuid,
    p_amount numeric,
    p_staff_id uuid,
    p_payer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
    v_new_paid numeric;
    v_status text;
    v_fee numeric;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'amount');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
    END IF;

    v_fee := public.platform_fee_for(p_amount);

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, payer_name,
        collected_by, status, platform_fee, fee_settled
    )
    VALUES (
        v_bill.id, v_bill.venue_id, p_amount, 'cash',
        'CASH-' || upper(substr(md5(random()::text), 1, 8)),
        p_payer_name, v_staff.id, 'success', v_fee, false
    );

    v_new_paid := v_bill.amount_paid + p_amount;
    IF v_new_paid >= v_bill.total - 0.005 THEN
        v_status := 'paid';
        UPDATE public.bills
        SET amount_paid = v_new_paid, status = 'paid', closed_at = now(), updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        v_status := 'settling';
        UPDATE public.bills
        SET amount_paid = v_new_paid, status = 'settling', updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'cash_payment_recorded', 'bill', v_bill.id::text,
            jsonb_build_object('amount', p_amount, 'platform_fee', v_fee, 'remaining', GREATEST(v_new_paid - v_bill.total, 0)));

    RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'bill_status', v_status,
                              'remaining', GREATEST(v_bill.total - v_new_paid, 0));
END;
$$;

-- ── B3. WAITER-ONLY ORDER STATUS / CANCELLATION ────────────────
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
    VALUES (v_submission.venue_id, 'staff', v_staff.name,
            CASE WHEN p_status = 'cancelled' THEN 'order_cancelled' ELSE 'order_status_' || p_status END,
            'order_submission', v_submission.id::text,
            jsonb_build_object('from', v_submission.status, 'to', p_status));

    RETURN true;
END;
$$;

-- ── B4. 20-MINUTE SESSION EXPIRY ───────────────────────────────
ALTER TABLE public.customer_sessions
    DROP CONSTRAINT IF EXISTS customer_sessions_status_check;

ALTER TABLE public.customer_sessions
    ADD CONSTRAINT customer_sessions_status_check
    CHECK (status IN ('active', 'closed', 'expired'));

CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Auto-run it every minute via pg_cron (if enabled on the project).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('bysen-expire-sessions', '* * * * *', 'SELECT public.expire_stale_sessions()');
    END IF;
END $$;

-- ── C1. STAFF MANAGEMENT (owner writes) ────────────────────────
-- Owner-only list (never exposes pin_hash), create staff, activate/deactivate.
CREATE OR REPLACE FUNCTION public.staff_list(p_venue_id uuid)
RETURNS TABLE(
    id uuid, name text, phone text, email text, role text,
    is_active boolean, pin_set boolean, max_tables int,
    area_assignment text, hourly_rate numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active,
           s.pin_hash IS NOT NULL, s.max_tables, s.area_assignment,
           s.hourly_rate, s.created_at
    FROM public.staff s
    WHERE s.venue_id = p_venue_id
    ORDER BY s.name;
$$;

-- Add a staff member. The new member has no PIN yet — they set it
-- themselves on their first sign-in (staff_lookup returns pin_set=false).
CREATE OR REPLACE FUNCTION public.create_staff(
    p_venue_id uuid,
    p_name text,
    p_phone text,
    p_role text,
    p_email text DEFAULT NULL,
    p_hourly_rate numeric DEFAULT 0,
    p_max_tables int DEFAULT 6,
    p_area_assignment text DEFAULT NULL
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
    IF EXISTS (SELECT 1 FROM public.staff WHERE venue_id = p_venue_id AND phone = p_phone) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'phone_exists');
    END IF;

    INSERT INTO public.staff (
        venue_id, name, phone, email, role, pin, is_active,
        max_tables, area_assignment, hourly_rate
    )
    VALUES (
        p_venue_id, p_name, p_phone, p_email, p_role, '', true,
        p_max_tables, p_area_assignment, p_hourly_rate
    )
    RETURNING id INTO v_new_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (p_venue_id, 'staff', 'owner', 'staff_created', 'staff', v_new_id::text,
            jsonb_build_object('name', p_name, 'role', p_role));

    RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

-- Activate / deactivate a staff member (owner only).
CREATE OR REPLACE FUNCTION public.set_staff_active(p_staff_id uuid, p_active boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_owner uuid;
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id;
    IF NOT FOUND THEN RETURN false; END IF;
    SELECT owner_id INTO v_owner FROM public.venues WHERE id = v_staff.venue_id;
    IF v_owner IS DISTINCT FROM auth.uid() THEN
        RETURN false;
    END IF;
    UPDATE public.staff SET is_active = p_active WHERE id = p_staff_id;
    RETURN true;
END;
$$;

-- ── C2. MANAGER DASHBOARD HELPERS ──────────────────────────────
-- What the restaurant owes Bysen (fees on cash payments, unpaid).
CREATE OR REPLACE FUNCTION public.outstanding_balance(p_venue_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(SUM(platform_fee), 0)
    FROM public.payments
    WHERE venue_id = p_venue_id
      AND fee_settled = false
      AND status = 'success';
$$;

-- Sessions that landed but never ordered (waiters approach them).
CREATE OR REPLACE FUNCTION public.landed_without_orders(p_venue_id uuid)
RETURNS TABLE(
    session_id uuid, table_number int, table_label text,
    created_at timestamptz, age_minutes int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT cs.id, t.table_number, t.table_label, cs.created_at,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - cs.created_at)) / 60))::int
    FROM public.customer_sessions cs
    JOIN public.tables t ON t.id = cs.table_id
    WHERE cs.venue_id = p_venue_id
      AND cs.status = 'active'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      )
    ORDER BY cs.created_at;
$$;

-- Open bills per table (with merged-bill info for connected tables).
CREATE OR REPLACE FUNCTION public.open_bill_overview(p_venue_id uuid)
RETURNS TABLE(
    bill_id uuid, table_number int, table_label text, guests int,
    waiter_name text, total numeric, amount_paid numeric, age_minutes int,
    is_merged bool, merged_into_bill_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT b.id, t.table_number, t.table_label, b.guest_count,
           s.name, b.total, b.amount_paid,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.created_at)) / 60))::int,
           COALESCE(b.is_merged, false), b.merged_into_bill_id
    FROM public.bills b
    JOIN public.tables t ON t.id = b.table_id
    LEFT JOIN public.staff s ON s.id = b.waiter_id
    WHERE b.venue_id = p_venue_id
      AND b.status IN ('open', 'settling')
    ORDER BY b.created_at;
$$;

-- ── C3. TABLE OPERATIONS (transfer / merge / split) ─────────────
-- Recompute a bill's subtotal / service charge / VAT / total from
-- its order items, using the venue's fee percentages. Used after
-- merge and split move items between bills.
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_venue public.venues%ROWTYPE;
    v_subtotal numeric;
    v_service numeric;
    v_vat numeric;
    v_total numeric;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;

    SELECT * INTO v_venue FROM public.venues WHERE id = v_bill.venue_id;

    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.order_items WHERE bill_id = p_bill_id;

    v_service := ROUND(v_subtotal * v_venue.service_charge_pct / 100, 2);
    v_vat := ROUND(v_subtotal * v_venue.vat_pct / 100, 2);
    v_total := v_subtotal + v_service + v_vat + v_bill.convenience_fee;

    UPDATE public.bills
    SET subtotal = v_subtotal, service_charge = v_service,
        vat = v_vat, total = v_total, updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'subtotal', v_subtotal, 'total', v_total);
END;
$$;

-- Move an open bill to another table (waiter only, same venue).
CREATE OR REPLACE FUNCTION public.transfer_bill(
    p_bill_id uuid, p_dest_table_id uuid, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
    v_dest public.tables%ROWTYPE;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
    END IF;

    SELECT * INTO v_dest FROM public.tables WHERE id = p_dest_table_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_dest.venue_id IS DISTINCT FROM v_bill.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'dest_table_invalid');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.bills
        WHERE table_id = p_dest_table_id AND status IN ('open', 'settling')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'table_occupied');
    END IF;

    UPDATE public.bills
    SET table_id = p_dest_table_id, updated_at = now()
    WHERE id = p_bill_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'bill_transferred', 'bill', v_bill.id::text,
            jsonb_build_object('from_table', v_bill.table_id, 'to_table', p_dest_table_id));

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Combine two open bills into one (items, session and totals move).
CREATE OR REPLACE FUNCTION public.merge_bills(
    p_source_bill_id uuid, p_dest_bill_id uuid, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_source public.bills%ROWTYPE;
    v_dest public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_source FROM public.bills WHERE id = p_source_bill_id LIMIT 1;
    SELECT * INTO v_dest FROM public.bills WHERE id = p_dest_bill_id LIMIT 1;
    IF NOT FOUND OR v_source.status NOT IN ('open', 'settling')
       OR v_dest.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;
    IF v_source.venue_id IS DISTINCT FROM v_dest.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'venue_mismatch');
    END IF;
    IF v_source.id = v_dest.id OR v_source.is_merged OR v_dest.is_merged THEN
        RETURN jsonb_build_object('ok', false, 'error', 'already_merged');
    END IF;

    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_staff.venue_id IS DISTINCT FROM v_source.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
    END IF;

    UPDATE public.order_items SET bill_id = v_dest.id WHERE bill_id = v_source.id;
    UPDATE public.customer_sessions SET bill_id = v_dest.id WHERE bill_id = v_source.id;

    UPDATE public.bills
    SET guest_count = v_dest.guest_count + v_source.guest_count,
        is_merged = true, updated_at = now()
    WHERE id = v_dest.id;

    UPDATE public.bills
    SET status = 'cancelled', is_merged = true, merged_into_bill_id = v_dest.id,
        closed_at = now(), updated_at = now()
    WHERE id = v_source.id;

    PERFORM public.recompute_bill_totals(v_dest.id);

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_source.venue_id, 'staff', v_staff.name, 'bills_merged', 'bill', v_source.id::text,
            jsonb_build_object('into', v_dest.id));

    RETURN jsonb_build_object('ok', true, 'bill_id', v_dest.id);
END;
$$;

-- Split an open bill evenly across N new bills (greedy item balance).
CREATE OR REPLACE FUNCTION public.split_bill(
    p_bill_id uuid, p_ways int, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
    v_item public.order_items%ROWTYPE;
    v_new_id uuid;
    v_new_bill_ids uuid[] := '{}';
    v_totals numeric[] := '{}';
    v_smallest int;
    i int;
BEGIN
    IF p_ways < 2 OR p_ways > 12 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_ways');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
    END IF;

    FOR i IN 1..p_ways LOOP
        INSERT INTO public.bills (venue_id, table_id, waiter_id, guest_count, payment_model)
        VALUES (v_bill.venue_id, v_bill.table_id, v_bill.waiter_id,
                GREATEST(1, ceil(v_bill.guest_count::numeric / p_ways)::int),
                v_bill.payment_model)
        RETURNING id INTO v_new_id;
        v_new_bill_ids := array_append(v_new_bill_ids, v_new_id);
        v_totals := array_append(v_totals, 0);
    END LOOP;

    -- Give each item (largest first) to the currently-smallest new bill.
    FOR v_item IN
        SELECT * FROM public.order_items WHERE bill_id = p_bill_id ORDER BY line_total DESC
    LOOP
        v_smallest := 1;
        FOR i IN 2..p_ways LOOP
            IF v_totals[i] < v_totals[v_smallest] THEN
                v_smallest := i;
            END IF;
        END LOOP;
        UPDATE public.order_items SET bill_id = v_new_bill_ids[v_smallest] WHERE id = v_item.id;
        v_totals[v_smallest] := v_totals[v_smallest] + v_item.line_total;
    END LOOP;

    UPDATE public.customer_sessions SET bill_id = v_new_bill_ids[1] WHERE bill_id = p_bill_id;

    FOR i IN 1..p_ways LOOP
        PERFORM public.recompute_bill_totals(v_new_bill_ids[i]);
    END LOOP;

    UPDATE public.bills
    SET status = 'cancelled', is_merged = true, merged_into_bill_id = v_new_bill_ids[1],
        closed_at = now(), updated_at = now()
    WHERE id = p_bill_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'bill_split', 'bill', v_bill.id::text,
            jsonb_build_object('ways', p_ways, 'new_bill_ids', v_new_bill_ids));

    RETURN jsonb_build_object('ok', true, 'bill_ids', v_new_bill_ids);
END;
$$;

-- ── C4. STAFF SHIFT SUMMARY (waiter performance, via RPC) ───────
-- Waiters are not Supabase auth users, so they cannot read payments /
-- shifts directly (RLS). This RPC verifies the staff member first and
-- returns their real shift metrics + recent activity.
CREATE OR REPLACE FUNCTION public.staff_shift_summary(p_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_staff public.staff%ROWTYPE;
    v_sales numeric;
    v_tables int;
    v_items int;
    v_shift_start timestamptz;
    v_shift_seconds int;
    v_activity jsonb;
BEGIN
    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
    END IF;

    SELECT MIN(clock_in) INTO v_shift_start
    FROM public.staff_shifts
    WHERE staff_id = p_staff_id AND status IN ('active', 'on_break');

    SELECT COALESCE(SUM(p.amount), 0) INTO v_sales
    FROM public.payments p
    WHERE p.collected_by = p_staff_id AND p.status = 'success'
      AND (v_shift_start IS NULL OR p.created_at >= v_shift_start);

    SELECT COUNT(DISTINCT b.id) INTO v_tables
    FROM public.bills b
    WHERE b.waiter_id = p_staff_id AND b.status IN ('open', 'settling', 'paid');

    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_items
    FROM public.order_items oi
    JOIN public.bills b ON b.id = oi.bill_id
    WHERE b.waiter_id = p_staff_id AND b.status IN ('open', 'settling', 'paid');

    v_shift_seconds := CASE WHEN v_shift_start IS NOT NULL
        THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - v_shift_start))::int)
        ELSE 0 END;

    SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.ts DESC), '[]'::jsonb) INTO v_activity
    FROM (
        SELECT 'settlement' AS type,
               'Table ' || lpad(t.table_number::text, 2, '0') || ' · ' || upper(p.method) AS label,
               p.amount::numeric AS amount,
               p.created_at AS ts
        FROM public.payments p
        JOIN public.bills b ON b.id = p.bill_id
        JOIN public.tables t ON t.id = b.table_id
        WHERE p.collected_by = p_staff_id AND p.status = 'success'
        UNION ALL
        SELECT 'table' AS type,
               'Opened Table ' || lpad(t.table_number::text, 2, '0') AS label,
               0::numeric AS amount,
               b.created_at AS ts
        FROM public.bills b
        JOIN public.tables t ON t.id = b.table_id
        WHERE b.waiter_id = p_staff_id
    ) x;

    RETURN jsonb_build_object(
        'ok', true,
        'sales', v_sales,
        'tables_served', v_tables,
        'items_sold', v_items,
        'shift_seconds', v_shift_seconds,
        'activity', v_activity
    );
END;
$$;

-- ── C5. CUSTOMER RESERVATION LOOKUP (tickets tab) ────────────────
-- Customers are anonymous (no auth), so they cannot SELECT reservations
-- under RLS. This returns only the rows matching the phone they
-- provided when booking.
CREATE OR REPLACE FUNCTION public.reservations_by_phone(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_rows jsonb;
BEGIN
    IF p_phone IS NULL OR length(trim(p_phone)) < 9 THEN
        RETURN jsonb_build_array();
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'customer_name', r.customer_name,
        'guest_count', r.guest_count,
        'seating_area', r.seating_area,
        'reservation_date', r.reservation_date,
        'reservation_time', r.reservation_time::text,
        'status', r.status,
        'created_at', r.created_at
    ) ORDER BY r.reservation_date DESC, r.reservation_time DESC), '[]'::jsonb)
    INTO v_rows
    FROM public.reservations r
    WHERE r.customer_phone = trim(p_phone);
    RETURN v_rows;
END;
$$;

-- ── D. REALTIME (live updates — no polling) ────────────────────
-- These are the tables the app subscribes to. If you ever add more,
-- repeat the pattern: SQL Editor → `ALTER PUBLICATION supabase_realtime
-- ADD TABLE public.<name>;` (or toggle it in Dashboard → Database →
-- Replication → Realtime → select the table → Enable).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_submissions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_submissions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bills') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
END $$;

-- ── E. PAYMENT HARDENING (idempotent) ──────────────────────────
-- Backs up the verify-payment / paystack-webhook edge functions:
--   * UNIQUE payments.reference          → insert-vs-dedupe is atomic
--     (both functions race for the same Paystack reference; without
--     this, a concurrent pair can double-credit a bill).
--   * UNIQUE payment_events.paystack_reference → single audit row.
--   * Auto-close trigger                 → close logic lives in the DB
--     (both functions deliberately do NOT close bills).
-- If duplicate references already exist (they are the bug), the
-- earliest row wins and later duplicates are removed.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paystack_data jsonb;
ALTER TABLE public.payment_events ADD COLUMN IF NOT EXISTS paystack_reference text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE schemaname = 'public' AND indexname = 'payments_reference_key') THEN
        -- Keep the earliest payment for a reference; drop later dupes
        -- (and any audit rows pointing at the dupes).
        DELETE FROM public.payment_events pe
        USING public.payments dup, public.payments keep
        WHERE pe.paystack_reference = dup.reference
          AND dup.reference = keep.reference
          AND dup.ctid > keep.ctid;
        DELETE FROM public.payments dup
        USING public.payments keep
        WHERE dup.reference = keep.reference
          AND dup.reference IS NOT NULL
          AND dup.ctid > keep.ctid;
        CREATE UNIQUE INDEX payments_reference_key ON public.payments (reference);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE schemaname = 'public' AND indexname = 'payment_events_paystack_reference_key') THEN
        DELETE FROM public.payment_events dup
        USING public.payment_events keep
        WHERE dup.paystack_reference = keep.paystack_reference
          AND dup.paystack_reference IS NOT NULL
          AND dup.ctid > keep.ctid;
        CREATE UNIQUE INDEX payment_events_paystack_reference_key
            ON public.payment_events (paystack_reference);
    END IF;
END $$;

-- Bill auto-close trigger. Mirrors record_cash_payment's logic: a bill
-- closes only when its 'success' payments cover `total`, so partial
-- cash payments keep it 'settling'. Online payments always carry the
-- full amount (gated in the edge functions), so they close on insert.
CREATE OR REPLACE FUNCTION public.bill_auto_close_on_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_paid numeric;
BEGIN
    IF NEW.status <> 'success' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = NEW.bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = NEW.bill_id AND status = 'success';

    IF v_paid >= v_bill.total - 0.005 THEN
        UPDATE public.bills
        SET amount_paid = v_paid, status = 'paid', closed_at = now(), updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET amount_paid = v_paid, status = 'settling', updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_auto_close ON public.payments;
CREATE TRIGGER trg_payments_auto_close
    AFTER INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.bill_auto_close_on_payment();

-- ── F. MANAGER WRITE POLICIES ──────────────────────────────────
-- The owner RLS section only grants reads; these add the writes the
-- manager screens perform (menu inventory CRUD, CRM VIP toggle).
DROP POLICY IF EXISTS "Owner manages inventory" ON public.inventory_items;
CREATE POLICY "Owner manages inventory" ON public.inventory_items
    FOR ALL USING (venue_id = public.owner_venue_id())
    WITH CHECK (venue_id = public.owner_venue_id());

DROP POLICY IF EXISTS "Owner updates customers" ON public.customer_profiles;
CREATE POLICY "Owner updates customers" ON public.customer_profiles
    FOR UPDATE USING (venue_id = public.owner_venue_id())
    WITH CHECK (venue_id = public.owner_venue_id());

-- ── F2. VENUE BRANDING ──────────────────────────────────────────
-- Each restaurant carries its own brand: color palette + logo URL.
ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS brand_primary text,
    ADD COLUMN IF NOT EXISTS brand_secondary text,
    ADD COLUMN IF NOT EXISTS brand_accent text,
    ADD COLUMN IF NOT EXISTS brand_text_secondary text,
    ADD COLUMN IF NOT EXISTS brand_danger text,
    ADD COLUMN IF NOT EXISTS brand_light_blue text;

DROP POLICY IF EXISTS "Owner manages own venue" ON public.venues;
CREATE POLICY "Owner manages own venue" ON public.venues
    FOR UPDATE USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify with:
--   SELECT name, phone, role, pin_hash IS NOT NULL AS has_pin FROM staff ORDER BY role;
--   SELECT public.staff_lookup('0240000001');
--   SELECT name, owner_id IS NOT NULL AS owner_linked FROM venues WHERE slug='velvet-lounge';
--   SELECT public.platform_fee_for(45), public.platform_fee_for(60), public.platform_fee_for(5000);
--     -- expect 1.00 | 1.00 | 15.00
--   SELECT public.expire_stale_sessions();
--   SELECT public.outstanding_balance((SELECT id FROM venues WHERE slug='velvet-lounge'));
--   SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename;
--   SELECT public.transfer_bill((SELECT id FROM bills WHERE status='open' LIMIT 1), '<dest_table_id>', '<staff_id>');
--   -- New in section E:
--   SELECT indexname FROM pg_indexes
--     WHERE indexname IN ('payments_reference_key', 'payment_events_paystack_reference_key');
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_payments_auto_close';
--   -- Manual smoke test (after a test payment):
--   --   SELECT id, status, amount_paid, closed_at FROM bills ORDER BY updated_at DESC LIMIT 3;
-- ═══════════════════════════════════════════════════════════════
