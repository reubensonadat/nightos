-- ═══════════════════════════════════════════════════════════════════
-- BYSEN / NIGHTOS — CLEAN UNIFIED DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- 1. RESET & CLEAN SLATE
DROP TABLE IF EXISTS public.otp_codes CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.customer_sessions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.order_submissions CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.product_modifiers CASCADE;
DROP TABLE IF EXISTS public.modifier_options CASCADE;
DROP TABLE IF EXISTS public.modifier_groups CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.menu_categories CASCADE;
DROP TABLE IF EXISTS public.staff_shifts CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;

-- Drop obsolete helper functions
DROP FUNCTION IF EXISTS public.is_venue_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.staff_list(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_waiter_to_bill(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.open_bill_for_waiter(uuid, uuid, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS public.recent_cash_fees(uuid, int) CASCADE;
DROP FUNCTION IF EXISTS public.get_venue_by_staff_phone(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_profile_by_phone(text) CASCADE;
DROP FUNCTION IF EXISTS public.venue_by_phone(text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_login(text) CASCADE;
DROP FUNCTION IF EXISTS public.normalise_phone(text) CASCADE;
DROP FUNCTION IF EXISTS public.check_phone_exists(text) CASCADE;
DROP FUNCTION IF EXISTS public.clock_in_staff(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.clock_out_staff(uuid) CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- 2. CORE UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.normalise_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT RIGHT(REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g'), 9);
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. TABLES DEFINITIONS
-- ═══════════════════════════════════════════════════════════════════

-- ── 3.1 VENUES ──
CREATE TABLE public.venues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    logo_url text,
    address text,
    phone text,
    email text,
    payment_model text NOT NULL DEFAULT 'POSTPAY' CHECK (payment_model IN ('PREPAY', 'POSTPAY')),
    service_charge_pct numeric(4,2) NOT NULL DEFAULT 10.00,
    vat_pct numeric(4,2) NOT NULL DEFAULT 12.50,
    tax_inclusive boolean NOT NULL DEFAULT false,
    currency text NOT NULL DEFAULT 'GHS',
    timezone text NOT NULL DEFAULT 'Africa/Accra',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    brand_primary text,
    brand_secondary text,
    brand_accent text,
    brand_text_secondary text,
    brand_danger text,
    brand_light_blue text
);

-- ── 3.2 STAFF & SHIFTS ──
CREATE TABLE public.staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role text NOT NULL CHECK (role IN ('owner','manager','supervisor','waiter','kitchen','bar','cashier')),
    pin text,
    is_active boolean NOT NULL DEFAULT true,
    max_tables int NOT NULL DEFAULT 6,
    area_assignment text,
    hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
    pay_model text NOT NULL DEFAULT 'hourly' CHECK (pay_model IN ('hourly', 'salary')),
    salary_amount numeric(10,2),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'closed')),
    clock_in timestamptz NOT NULL DEFAULT now(),
    clock_out timestamptz,
    supervisor_approved boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3.3 MENU & MODIFIERS ──
CREATE TABLE public.menu_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    long_description text,
    price numeric(10,2) NOT NULL DEFAULT 0,
    cost_price numeric(10,2),
    images text[] NOT NULL DEFAULT '{}',
    station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'both')),
    tags text[] NOT NULL DEFAULT '{}',
    abv text,
    origin text,
    is_active boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modifier_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    required boolean NOT NULL DEFAULT false,
    multi_select boolean NOT NULL DEFAULT false,
    max_select int,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modifier_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    price_delta numeric(10,2) NOT NULL DEFAULT 0,
    sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.product_modifiers (
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, group_id)
);

-- ── 3.4 TABLES & SESSIONS ──
CREATE TABLE public.tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_number int NOT NULL,
    table_label text NOT NULL,
    capacity int NOT NULL DEFAULT 4,
    area text NOT NULL DEFAULT 'Main',
    pos_x numeric(6,2),
    pos_y numeric(6,2),
    qr_code_url text,
    qr_code_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    bill_id uuid,
    session_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    guest_name text DEFAULT 'Guest',
    party_size int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    last_active_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
);

-- ── 3.5 BILLS, ORDERS & ITEMS ──
CREATE TABLE public.bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    waiter_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    guest_count int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settling', 'paid', 'cancelled')),
    payment_model text NOT NULL DEFAULT 'POSTPAY' CHECK (payment_model IN ('PREPAY', 'POSTPAY')),
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    convenience_fee numeric(10,2) NOT NULL DEFAULT 0,
    service_charge numeric(10,2) NOT NULL DEFAULT 0,
    vat numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    amount_paid numeric(10,2) NOT NULL DEFAULT 0,
    is_merged boolean NOT NULL DEFAULT false,
    merged_into_bill_id uuid REFERENCES public.bills(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    last_activity_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key from customer_sessions to bills now that bills exists
ALTER TABLE public.customer_sessions
    ADD CONSTRAINT fk_customer_sessions_bill
    FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;

CREATE TABLE public.order_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    customer_session_id uuid REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
    guest_name text,
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')),
    station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'both')),
    priority boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.order_submissions(id) ON DELETE CASCADE,
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    customer_session_id uuid REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text NOT NULL,
    quantity int NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL DEFAULT 0,
    modifier_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
    modifier_price_adjustment numeric(10,2) NOT NULL DEFAULT 0,
    line_total numeric(10,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')),
    notes text,
    guest_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3.6 PAYMENTS & PLATFORM FEES ──
CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    method text NOT NULL CHECK (method IN ('mobile_money', 'card', 'bank_transfer', 'digital_wallet', 'cash')),
    reference text UNIQUE,
    payer_name text,
    collected_by uuid REFERENCES public.staff(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    paystack_data jsonb,
    platform_fee numeric(10,2) NOT NULL DEFAULT 0,
    fee_settled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3.7 CUSTOMER PROFILES & TICKETS ──
CREATE TABLE public.customer_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text,
    phone text,
    email text,
    total_visits int NOT NULL DEFAULT 0,
    total_spend numeric(10,2) NOT NULL DEFAULT 0,
    loyalty_tier text NOT NULL DEFAULT 'new' CHECK (loyalty_tier IN ('new', 'regular', 'loyal', 'vip')),
    is_vip boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    event_name text NOT NULL,
    event_date date NOT NULL,
    event_time time NOT NULL,
    ticket_type text NOT NULL DEFAULT 'standard',
    price numeric(10,2) NOT NULL DEFAULT 0,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3.8 OTP STORAGE (EASY LOGIN & DEV LOOKUP) ──
CREATE TABLE public.otp_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    is_used boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3.9 EXPENSES, INVENTORY & AUDIT LOGS ──
CREATE TABLE public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    recorded_by uuid REFERENCES public.staff(id),
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    name text NOT NULL,
    category text NOT NULL DEFAULT 'General',
    stock_qty numeric(10,2) NOT NULL DEFAULT 0,
    unit text NOT NULL DEFAULT 'units',
    reorder_threshold numeric(10,2) NOT NULL DEFAULT 5,
    unit_cost numeric(10,2) NOT NULL DEFAULT 0,
    supplier text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'wastage', 'adjustment')),
    quantity numeric(10,2) NOT NULL,
    cost_total numeric(10,2),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_phone text,
    customer_email text,
    guest_count int NOT NULL DEFAULT 2,
    seating_area text,
    reservation_date date NOT NULL,
    reservation_time time NOT NULL,
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'seated', 'cancelled', 'completed')),
    deposit_amount numeric(10,2) NOT NULL DEFAULT 0,
    deposit_paid boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    actor_id uuid,
    actor_name text,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. RPC FUNCTIONS (CLEAN & RELIABLE)
-- ═══════════════════════════════════════════════════════════════════

-- ── 4.1 Check Phone Exists ──
CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff WHERE public.normalise_phone(phone) = public.normalise_phone(p_phone)
        UNION
        SELECT 1 FROM public.venues WHERE public.normalise_phone(phone) = public.normalise_phone(p_phone)
    );
$$;

-- ── 4.2 Venue By Staff Phone ──
CREATE OR REPLACE FUNCTION public.get_venue_by_staff_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT s.venue_id, s.role, row_to_json(v.*)::jsonb AS venue
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE public.normalise_phone(s.phone) = public.normalise_phone(p_phone)
      AND s.is_active = true
      AND v.is_active = true
    LIMIT 1;
$$;

-- ── 4.3 Get Staff Profile By Phone ──
CREATE OR REPLACE FUNCTION public.get_staff_profile_by_phone(p_phone text)
RETURNS TABLE (
    id uuid,
    name text,
    phone text,
    email text,
    role text,
    venue_id uuid,
    venue_name text,
    venue_slug text,
    is_active boolean,
    area_assignment text,
    max_tables int
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        s.id,
        s.name,
        s.phone,
        s.email,
        s.role,
        v.id AS venue_id,
        v.name AS venue_name,
        v.slug AS venue_slug,
        s.is_active,
        s.area_assignment,
        s.max_tables
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE public.normalise_phone(s.phone) = public.normalise_phone(p_phone)
      AND s.is_active = true
    LIMIT 1;
$$;

-- ── 4.4 Venue By Phone (Owner) ──
CREATE OR REPLACE FUNCTION public.venue_by_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT v.id, 'owner'::text, row_to_json(v.*)::jsonb AS venue
    FROM public.venues v
    WHERE public.normalise_phone(v.phone) = public.normalise_phone(p_phone)
      AND v.is_active = true
    LIMIT 1;
$$;

-- ── 4.5 Resolve Login (Unified Owner / Staff identifier) ──
CREATE OR REPLACE FUNCTION public.resolve_login(identifier text)
RETURNS TABLE (role text, venue_id uuid, venue_slug text, venue_name text, staff_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_norm text := public.normalise_phone(identifier);
BEGIN
    -- Check Owner by phone
    RETURN QUERY
    SELECT 'owner'::text, v.id, v.slug, v.name, NULL::uuid
    FROM public.venues v
    WHERE public.normalise_phone(v.phone) = v_norm AND v.is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Check Staff by phone
    RETURN QUERY
    SELECT s.role::text, v.id, v.slug, v.name, s.id
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE public.normalise_phone(s.phone) = v_norm AND s.is_active = true AND v.is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Check by email
    RETURN QUERY
    SELECT s.role::text, v.id, v.slug, v.name, s.id
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE LOWER(s.email) = LOWER(identifier) AND s.is_active = true AND v.is_active = true
    LIMIT 1;
END;
$$;

-- ── 4.6 Staff Directory Listing ──
CREATE OR REPLACE FUNCTION public.staff_list(p_venue_id uuid)
RETURNS TABLE(
    id uuid, name text, phone text, email text, role text,
    is_active boolean, pin_set boolean, max_tables int,
    area_assignment text, hourly_rate numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active,
           (s.pin IS NOT NULL AND s.pin != '') AS pin_set,
           s.max_tables, s.area_assignment, s.hourly_rate, s.created_at
    FROM public.staff s
    WHERE s.venue_id = p_venue_id
    ORDER BY s.name;
$$;

-- ── 4.7 Shift Clock-in / Clock-out ──
CREATE OR REPLACE FUNCTION public.clock_in_staff(p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_venue_id uuid;
BEGIN
    SELECT venue_id INTO v_venue_id FROM public.staff WHERE id = p_staff_id AND is_active = true;
    IF v_venue_id IS NULL THEN RETURN false; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.staff_shifts
        WHERE staff_id = p_staff_id AND status IN ('active', 'on_break')
    ) THEN
        INSERT INTO public.staff_shifts (staff_id, venue_id, status)
        VALUES (p_staff_id, v_venue_id, 'active');
    END IF;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_out_staff(p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.staff_shifts
    SET status = 'closed', clock_out = now()
    WHERE staff_id = p_staff_id AND status IN ('active', 'on_break');
    RETURN FOUND;
END;
$$;

-- ── 4.8 Open Bill for Waiter (Idempotent: 1 Open Bill per Table) ──
CREATE OR REPLACE FUNCTION public.open_bill_for_waiter(
    p_venue_id uuid,
    p_table_id uuid,
    p_waiter_id uuid DEFAULT NULL,
    p_guest_count int DEFAULT 1
)
RETURNS TABLE (
    id uuid,
    venue_id uuid,
    table_id uuid,
    waiter_id uuid,
    guest_count int,
    status text,
    payment_model text,
    subtotal numeric,
    service_charge numeric,
    vat numeric,
    total numeric,
    amount_paid numeric,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bill_id uuid;
    v_model text;
BEGIN
    -- Look for existing open/settling bill on this table
    SELECT b.id INTO v_bill_id
    FROM public.bills b
    WHERE b.table_id = p_table_id
      AND b.status IN ('open', 'settling')
    ORDER BY b.created_at DESC
    LIMIT 1;

    IF v_bill_id IS NULL THEN
        SELECT COALESCE(payment_model, 'POSTPAY') INTO v_model
        FROM public.venues WHERE venues.id = p_venue_id;

        INSERT INTO public.bills (venue_id, table_id, waiter_id, guest_count, payment_model, status)
        VALUES (p_venue_id, p_table_id, p_waiter_id, GREATEST(1, p_guest_count), COALESCE(v_model, 'POSTPAY'), 'open')
        RETURNING bills.id INTO v_bill_id;
    ELSIF p_waiter_id IS NOT NULL THEN
        -- Attach waiter if not yet set
        UPDATE public.bills SET waiter_id = COALESCE(bills.waiter_id, p_waiter_id)
        WHERE bills.id = v_bill_id;
    END IF;

    RETURN QUERY
    SELECT b.id, b.venue_id, b.table_id, b.waiter_id, b.guest_count, b.status,
           b.payment_model, b.subtotal, b.service_charge, b.vat, b.total, b.amount_paid,
           b.created_at, b.updated_at
    FROM public.bills b
    WHERE b.id = v_bill_id;
END;
$$;

-- ── 4.9 Robust Auto-Assign Waiter to Bill ──
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_table_area text;
    v_best_waiter_id uuid;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF v_bill.waiter_id IS NOT NULL THEN RETURN v_bill.waiter_id; END IF;

    SELECT area INTO v_table_area FROM public.tables WHERE id = v_bill.table_id;

    -- Tier 1: Waiter on active shift matching area with fewest open bills
    SELECT s.id INTO v_best_waiter_id
    FROM public.staff s
    LEFT JOIN public.bills b ON b.waiter_id = s.id AND b.status IN ('open', 'settling')
    WHERE s.venue_id = v_bill.venue_id
      AND s.role = 'waiter'
      AND s.is_active = true
      AND EXISTS (SELECT 1 FROM public.staff_shifts ss WHERE ss.staff_id = s.id AND ss.status = 'active')
      AND (s.area_assignment IS NULL OR s.area_assignment = v_table_area)
    GROUP BY s.id
    ORDER BY COUNT(b.id) ASC
    LIMIT 1;

    -- Tier 2 Fallback: Any active waiter in the venue
    IF v_best_waiter_id IS NULL THEN
        SELECT s.id INTO v_best_waiter_id
        FROM public.staff s
        WHERE s.venue_id = v_bill.venue_id
          AND s.role = 'waiter'
          AND s.is_active = true
        ORDER BY s.created_at ASC
        LIMIT 1;
    END IF;

    IF v_best_waiter_id IS NOT NULL THEN
        UPDATE public.bills SET waiter_id = v_best_waiter_id WHERE id = p_bill_id;
    END IF;

    RETURN v_best_waiter_id;
END;
$$;

-- ── 4.10 Platform Convenience Fee (Tiered GHS 1, 2, 3, 4, 5) ──
CREATE OR REPLACE FUNCTION public.compute_convenience_fee(subtotal numeric)
RETURNS numeric(10,2) AS $$
BEGIN
    IF subtotal IS NULL OR subtotal <= 0 THEN
        RETURN 0.00;
    ELSIF subtotal <= 50 THEN
        RETURN 1.00;
    ELSIF subtotal <= 100 THEN
        RETURN 2.00;
    ELSIF subtotal <= 150 THEN
        RETURN 3.00;
    ELSIF subtotal <= 200 THEN
        RETURN 4.00;
    ELSE
        RETURN 5.00;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.recalculate_single_bill(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_subtotal numeric(10,2);
    v_fee numeric(10,2) := 0;
    v_total numeric(10,2) := 0;
    v_paid numeric(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(oi.line_total), 0) INTO v_subtotal
    FROM public.order_items oi
    JOIN public.order_submissions os ON os.id = oi.submission_id
    WHERE oi.bill_id = p_bill_id
      AND COALESCE(oi.status, 'confirmed') != 'cancelled'
      AND COALESCE(os.status, 'confirmed') != 'cancelled';

    -- Tiered Platform Fee: 1, 2, 3, 4, 5
    v_fee := public.compute_convenience_fee(v_subtotal);
    v_total := v_subtotal + v_fee;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = p_bill_id AND status = 'success';

    UPDATE public.bills
    SET subtotal = v_subtotal,
        convenience_fee = v_fee,
        service_charge = 0.00,
        vat = 0.00,
        total = v_total,
        amount_paid = v_paid,
        status = CASE
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            WHEN status = 'paid' AND v_paid < (v_total - 0.01) THEN 'open'
            ELSE status
        END,
        closed_at = CASE WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN now() ELSE closed_at END,
        updated_at = now()
    WHERE id = p_bill_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_status(
    p_submission_id uuid,
    p_status text,
    p_staff_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    IF p_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled') THEN
        RETURN false;
    END IF;

    UPDATE public.order_submissions
    SET status = p_status, updated_at = now()
    WHERE id = p_submission_id
    RETURNING bill_id INTO v_bill_id;

    IF p_status = 'cancelled' THEN
        UPDATE public.order_items
        SET status = 'cancelled'
        WHERE submission_id = p_submission_id;
    END IF;

    IF v_bill_id IS NOT NULL THEN
        PERFORM public.recalculate_single_bill(v_bill_id);
    END IF;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_bill(
    p_bill_id uuid,
    p_staff_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.bills
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE id = p_bill_id;

    UPDATE public.customer_sessions
    SET status = 'closed', closed_at = now()
    WHERE bill_id = p_bill_id;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_item_status(
    p_item_id uuid,
    p_status text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    IF p_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled') THEN
        RETURN false;
    END IF;

    UPDATE public.order_items
    SET status = p_status
    WHERE id = p_item_id
    RETURNING bill_id INTO v_bill_id;

    IF v_bill_id IS NOT NULL THEN
        PERFORM public.recalculate_single_bill(v_bill_id);
    END IF;

    RETURN FOUND;
END;
$$;

-- ── 4.11 Recent Cash Fees Ledger ──
CREATE OR REPLACE FUNCTION public.recent_cash_fees(p_venue_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE(
    payment_id uuid,
    amount numeric,
    platform_fee numeric,
    fee_settled boolean,
    created_at timestamptz,
    table_number int,
    table_label text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        p.id AS payment_id,
        p.amount,
        p.platform_fee,
        p.fee_settled,
        p.created_at,
        t.table_number,
        t.table_label
    FROM public.payments p
    JOIN public.bills b ON b.id = p.bill_id
    JOIN public.tables t ON t.id = b.table_id
    WHERE p.venue_id = p_venue_id
      AND p.method = 'cash'
      AND p.status = 'success'
    ORDER BY p.created_at DESC
    LIMIT p_limit;
$$;

-- ── 4.12 Recalculate Bill Totals Trigger ──
CREATE OR REPLACE FUNCTION public.recalculate_bill_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_bill_id := OLD.bill_id;
    ELSE
        v_bill_id := NEW.bill_id;
    END IF;

    IF v_bill_id IS NOT NULL THEN
        PERFORM public.recalculate_single_bill(v_bill_id);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_bill_order_items ON public.order_items;
CREATE TRIGGER trg_recalc_bill_order_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill_totals();

DROP TRIGGER IF EXISTS trg_recalc_bill_order_submissions ON public.order_submissions;
CREATE TRIGGER trg_recalc_bill_order_submissions
AFTER INSERT OR UPDATE OF status ON public.order_submissions
FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill_totals();

DROP TRIGGER IF EXISTS trg_recalc_bill_payments ON public.payments;
CREATE TRIGGER trg_recalc_bill_payments
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill_totals();

-- ═══════════════════════════════════════════════════════════════════
-- 5. REALTIME PUBLICATIONS
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_submissions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_shifts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. PERMISSIONS & OPEN ACCESS (NO 403s)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
