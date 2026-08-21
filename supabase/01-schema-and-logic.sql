DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.customer_profiles CASCADE;
DROP TABLE IF EXISTS public.event_tickets CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.customer_sessions CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.payment_events CASCADE;
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
DROP TABLE IF EXISTS public.venue_settings CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;

CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_phone text;
BEGIN
    IF target_venue_id IS NULL THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.venues WHERE id = target_venue_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    SELECT raw_user_meta_data->>'phone' INTO user_phone
    FROM auth.users WHERE id = auth.uid();
    IF user_phone IS NULL OR user_phone = '' THEN
        SELECT u.phone INTO user_phone FROM auth.users u WHERE u.id = auth.uid();
    END IF;
    IF user_phone IS NULL OR user_phone = '' THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id
          AND public.normalise_phone(phone) = public.normalise_phone(user_phone)
          AND is_active = true
    ) OR EXISTS (
        SELECT 1 FROM public.venues
        WHERE id = target_venue_id
          AND public.normalise_phone(phone) = public.normalise_phone(user_phone)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.venue_by_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT v.id, 'owner'::text, row_to_json(v.*)::jsonb AS venue
    FROM public.venues v
    WHERE RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9)
        = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND v.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_venue_member(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.venue_by_phone(text) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.venues (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    CONSTRAINT venues_pkey PRIMARY KEY (id)
);
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue owner can manage" ON public.venues FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can read active venues" ON public.venues FOR SELECT USING (is_active = true);

CREATE OR REPLACE FUNCTION public.get_venue_by_staff_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT s.venue_id, s.role, row_to_json(v.*)::jsonb AS venue
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
      AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff read their own profile via Supabase phone OTP auth. This RPC
-- securely bypasses RLS (avoids the 403 infinite recursion on public.staff)
-- and never exposes the PIN (there is none).
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

CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
        UNION ALL
        SELECT 1 FROM public.customer_profiles
        WHERE RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
    ) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.venue_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT venue_settings_pkey PRIMARY KEY (id),
    CONSTRAINT venue_settings_venue_id_key UNIQUE (venue_id, key)
);
ALTER TABLE public.venue_settings ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage settings" ON public.venue_settings FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.tables (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_number integer NOT NULL,
    table_label text NOT NULL,
    capacity integer NOT NULL DEFAULT 4,
    area text NOT NULL DEFAULT 'Main' CHECK (area IN ('Main', 'VIP', 'Lounge', 'Bar', 'Outdoor', 'Private')),
    pos_x integer,
    pos_y integer,
    qr_code_url text,
    qr_code_token text NOT NULL DEFAULT gen_random_uuid()::text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tables_pkey PRIMARY KEY (id),
    CONSTRAINT tables_venue_id_table_number UNIQUE (venue_id, table_number)
);
ALTER TABLE public.tables ENABLE ROW LEVEL security;
CREATE POLICY "Venue staff can read tables" ON public.tables FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Public can read active tables" ON public.tables FOR SELECT USING (is_active = true);
CREATE POLICY "Venue owner can manage tables" ON public.tables FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role text NOT NULL DEFAULT 'waiter' CHECK (role IN ('owner', 'manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier')),
    is_active boolean NOT NULL DEFAULT true,
    max_tables integer NOT NULL DEFAULT 6,
    area_assignment text,
    hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
    pay_model text NOT NULL DEFAULT 'hourly' CHECK (pay_model IN ('hourly', 'salary')),
    salary_amount numeric(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT staff_pkey PRIMARY KEY (id),
    CONSTRAINT staff_venue_id_phone UNIQUE (venue_id, phone)
);
ALTER TABLE public.staff ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage staff" ON public.staff FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
CREATE POLICY "Staff can read own venue staff list" ON public.staff FOR SELECT USING (public.is_venue_member(venue_id));

CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    clock_in timestamptz NOT NULL DEFAULT now(),
    clock_out timestamptz,
    cash_balance_start numeric(10,2) NOT NULL DEFAULT 0,
    cash_balance_end numeric(10,2),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT staff_shifts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL security;
CREATE POLICY "Staff can read own shifts" ON public.staff_shifts FOR SELECT
    USING (staff_id IN (SELECT id FROM public.staff WHERE phone = auth.jwt()->>'phone'));
CREATE POLICY "Venue members can read shifts" ON public.staff_shifts
    FOR SELECT USING (public.is_venue_member(venue_id));

-- Auto shifts: sign-in clocks in (idempotent — reloads/token refreshes
-- reuse the existing active shift), sign-out clocks out. These feed
-- assign_waiter_to_bill and the LiveOps coverage stats.
CREATE OR REPLACE FUNCTION public.clock_in_staff(p_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_venue_id uuid;
BEGIN
    SELECT venue_id INTO v_venue_id
    FROM public.staff
    WHERE id = p_staff_id AND is_active = true;
    IF v_venue_id IS NULL THEN
        RETURN false;
    END IF;
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
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.staff_shifts
    SET status = 'closed', clock_out = now()
    WHERE staff_id = p_staff_id AND status IN ('active', 'on_break');
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_in_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out_staff(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.menu_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT menu_categories_pkey PRIMARY KEY (id),
    CONSTRAINT menu_categories_venue_id_name UNIQUE (venue_id, name)
);
ALTER TABLE public.menu_categories ENABLE ROW LEVEL security;
CREATE POLICY "Public can read menu categories" ON public.menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Venue owner can manage categories" ON public.menu_categories FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    long_description text,
    price numeric(10,2) NOT NULL,
    cost_price numeric(10,2) DEFAULT 0,
    images jsonb DEFAULT '[]'::jsonb,
    station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'both')),
    tags jsonb DEFAULT '[]'::jsonb,
    abv text,
    origin text,
    is_active boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT products_pkey PRIMARY KEY (id)
);
ALTER TABLE public.products ENABLE ROW LEVEL security;
CREATE POLICY "Public can read active products" ON public.products FOR SELECT
    USING (is_active = true AND is_archived = false);
CREATE POLICY "Venue owner can manage products" ON public.products FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    required boolean NOT NULL DEFAULT false,
    multi_select boolean NOT NULL DEFAULT false,
    max_select integer,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT modifier_groups_pkey PRIMARY KEY (id)
);
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL security;
CREATE POLICY "Public can read modifier groups" ON public.modifier_groups FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.modifier_options (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    price_delta numeric(10,2) NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    CONSTRAINT modifier_options_pkey PRIMARY KEY (id)
);
ALTER TABLE public.modifier_options ENABLE ROW LEVEL security;
CREATE POLICY "Public can read modifier options" ON public.modifier_options FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.product_modifiers (
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    CONSTRAINT product_modifiers_pkey PRIMARY KEY (product_id, group_id)
);
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL security;
CREATE POLICY "Public can read product modifiers" ON public.product_modifiers FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.bills (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    waiter_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    guest_count integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settling', 'paid', 'cancelled')),
    payment_model text NOT NULL DEFAULT 'POSTPAY' CHECK (payment_model IN ('PREPAY', 'POSTPAY')),
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    service_charge numeric(10,2) NOT NULL DEFAULT 0,
    vat numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    amount_paid numeric(10,2) NOT NULL DEFAULT 0,
    is_merged boolean NOT NULL DEFAULT false,
    merged_into_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bills_pkey PRIMARY KEY (id)
);
ALTER TABLE public.bills ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read bills" ON public.bills FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update bills" ON public.bills FOR UPDATE USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue owner can manage bills" ON public.bills FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
    guest_name text NOT NULL DEFAULT 'Guest',
    party_size integer NOT NULL DEFAULT 1,
    session_token text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_active_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customer_sessions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL security;

CREATE TABLE IF NOT EXISTS public.order_submissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    customer_session_id uuid REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
    guest_name text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')),
    station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'both')),
    priority boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_submissions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.order_submissions ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read submissions" ON public.order_submissions FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update submissions" ON public.order_submissions FOR UPDATE USING (public.is_venue_member(venue_id));

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.order_submissions(id) ON DELETE CASCADE,
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_session_id uuid REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    modifier_snapshot jsonb DEFAULT '[]'::jsonb,
    modifier_price_adjustment numeric(10,2) NOT NULL DEFAULT 0,
    line_total numeric(10,2) NOT NULL,
    notes text,
    guest_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_items_pkey PRIMARY KEY (id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read order items" ON public.order_items FOR SELECT
    USING (public.is_venue_member((SELECT venue_id FROM public.bills WHERE id = bill_id)));

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    method text NOT NULL CHECK (method IN ('mobile_money', 'card', 'bank_transfer', 'digital_wallet', 'cash')),
    reference text,
    payer_name text,
    collected_by uuid REFERENCES public.staff(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    paystack_data jsonb,
    platform_fee numeric(10,2) NOT NULL DEFAULT 0,
    fee_settled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payments_pkey PRIMARY KEY (id)
);
ALTER TABLE public.payments ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read payments" ON public.payments FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue staff can insert payments" ON public.payments FOR INSERT WITH CHECK (public.is_venue_member(venue_id));

CREATE TABLE IF NOT EXISTS public.payment_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    paystack_reference text NOT NULL,
    bill_id uuid REFERENCES public.bills(id),
    event_type text NOT NULL,
    amount_pesewas integer,
    raw_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payment_events_pkey PRIMARY KEY (id),
    CONSTRAINT payment_events_reference UNIQUE (paystack_reference)
);
ALTER TABLE public.payment_events ENABLE ROW LEVEL security;
CREATE POLICY "Service role can manage payment_events" ON public.payment_events FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    name text NOT NULL,
    category text NOT NULL DEFAULT 'general',
    stock_qty numeric(10,2) NOT NULL DEFAULT 0,
    unit text NOT NULL DEFAULT 'pieces',
    reorder_threshold numeric(10,2) NOT NULL DEFAULT 0,
    unit_cost numeric(10,2) NOT NULL DEFAULT 0,
    supplier text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage inventory" ON public.inventory_items FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
CREATE POLICY "Venue staff can read inventory" ON public.inventory_items FOR SELECT USING (public.is_venue_member(venue_id));

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    qty_change numeric(10,2) NOT NULL,
    reason text NOT NULL CHECK (reason IN ('sale', 'restock', 'waste', 'spoilage', 'adjustment', 'variance')),
    reference_id text,
    notes text,
    created_by uuid REFERENCES public.staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage transactions" ON public.inventory_transactions FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.reservations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid REFERENCES public.tables(id),
    customer_name text NOT NULL,
    customer_phone text,
    customer_email text,
    guest_count integer NOT NULL DEFAULT 1,
    seating_area text,
    reservation_date date NOT NULL,
    reservation_time time NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')),
    deposit_amount numeric(10,2) NOT NULL DEFAULT 0,
    deposit_paid boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reservations_pkey PRIMARY KEY (id)
);
ALTER TABLE public.reservations ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can manage reservations" ON public.reservations FOR ALL USING (public.is_venue_member(venue_id));
CREATE POLICY "Public can create reservations" ON public.reservations FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.event_tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    event_name text NOT NULL,
    event_date date NOT NULL,
    event_time time NOT NULL,
    ticket_type text NOT NULL,
    price numeric(10,2) NOT NULL,
    quantity_total integer NOT NULL DEFAULT 0,
    quantity_sold integer NOT NULL DEFAULT 0,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_tickets_pkey PRIMARY KEY (id)
);
ALTER TABLE public.event_tickets ENABLE ROW LEVEL security;
CREATE POLICY "Public can read active tickets" ON public.event_tickets FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text,
    phone text,
    email text,
    total_visits integer NOT NULL DEFAULT 0,
    total_spend numeric(10,2) NOT NULL DEFAULT 0,
    loyalty_tier text NOT NULL DEFAULT 'new' CHECK (loyalty_tier IN ('new', 'regular', 'loyal', 'vip')),
    is_vip boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customer_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT customer_profiles_venue_id_phone UNIQUE (venue_id, phone)
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read customer profiles" ON public.customer_profiles FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update customer profiles" ON public.customer_profiles FOR UPDATE USING (public.is_venue_member(venue_id));
CREATE POLICY "Public can upsert their own profile" ON public.customer_profiles FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    category text NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    created_by uuid REFERENCES public.staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT expenses_pkey PRIMARY KEY (id)
);
ALTER TABLE public.expenses ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage expenses" ON public.expenses FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    actor_type text NOT NULL DEFAULT 'staff' CHECK (actor_type IN ('staff', 'system', 'customer')),
    actor_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'staff';
ALTER TABLE public.activity_logs ALTER COLUMN entity_id TYPE text USING entity_id::text;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can read logs" ON public.activity_logs FOR SELECT
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE OR REPLACE FUNCTION public.recalculate_bill()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    UPDATE public.bills b
    SET
        subtotal = (SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id),
        service_charge = ROUND((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id) * (SELECT COALESCE(service_charge_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id), 2),
        vat = ROUND((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id) * (SELECT COALESCE(vat_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id), 2)
    WHERE b.id = v_bill_id;
    UPDATE public.bills b SET total = subtotal + service_charge + vat WHERE b.id = v_bill_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_item_change
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill();

-- ────────────────────────────────────────────────────────────
-- TABLE DWELL TIME — bills.last_activity_at
-- Any change to a bill's items or payments resets the dwell clock.
-- Dwell = minutes since last_activity_at; used by the waiter/manager
-- dashboards to flag tables idle past the venue's max_dwell_minutes
-- (venue_settings key, default 120). Merge/split re-point order_items
-- → fires automatically.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_bill_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    IF v_bill_id IS NOT NULL THEN
        UPDATE public.bills
        SET last_activity_at = now(), updated_at = now()
        WHERE id = v_bill_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_activity_items ON public.order_items;
CREATE TRIGGER trg_bill_activity_items
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_bill_activity();

DROP TRIGGER IF EXISTS trg_bill_activity_payments ON public.payments;
CREATE TRIGGER trg_bill_activity_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.touch_bill_activity();

-- Default dwell threshold for every venue (idempotent — keeps the value
-- on re-runs of the full schema; change per venue directly in the table).
INSERT INTO public.venue_settings (venue_id, key, value)
SELECT v.id, 'max_dwell_minutes', '120'::jsonb
FROM public.venues v
WHERE NOT EXISTS (
    SELECT 1 FROM public.venue_settings s
    WHERE s.venue_id = v.id AND s.key = 'max_dwell_minutes'
);

CREATE OR REPLACE FUNCTION public.update_bill_payment()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
    v_total numeric(10,2);
    v_paid numeric(10,2);
BEGIN
    IF NEW.status = 'success' THEN
        v_bill_id := NEW.bill_id;
        UPDATE public.bills b SET amount_paid = amount_paid + NEW.amount WHERE b.id = v_bill_id;
        SELECT total, amount_paid INTO v_total, v_paid FROM public.bills WHERE id = v_bill_id;
        IF v_paid >= v_total THEN
            UPDATE public.bills SET status = 'paid', closed_at = now() WHERE id = v_bill_id;
        ELSIF v_paid > 0 THEN
            UPDATE public.bills SET status = 'settling' WHERE id = v_bill_id AND status = 'open';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_success
    AFTER INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_bill_payment();

CREATE OR REPLACE FUNCTION public.get_staff_by_phone(p_phone text)
RETURNS TABLE (id uuid, venue_id uuid, name text, role text, venue_name text, venue_slug text) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.venue_id, s.name, s.role, v.name, v.slug
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.phone = p_phone AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign waiter to bill â€” load-based, weighted by PEOPLE not just tables.
-- Load score = guests on the waiter's open bills + 0.5 per open table
-- (task-switching cost). A waiter with 6 tables of 1-2 people (â‰ˆ9 people)
-- ranks below a waiter with 3 tables of 5 people (15 people), so the big
-- party lands with the lightest-load waiter. Hard limits: max_tables,
-- active shift, area match.
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid AS $$
DECLARE
    v_bill  public.bills%ROWTYPE;
    v_table_area text;
    v_best_waiter_id uuid;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Idempotent: a bill that already has a waiter keeps that waiter.
    IF v_bill.waiter_id IS NOT NULL THEN RETURN v_bill.waiter_id; END IF;

    SELECT area INTO v_table_area FROM public.tables WHERE id = v_bill.table_id;

    -- PEOPLE-WEIGHTED LOAD BALANCING (source of truth):
    --   load = SUM(guests on open bills) + 0.5 per open table
    -- Example: waiter A has 4 tables of 5 people  (load ≈ 22)
    --          waiter B has 6 tables of 2 people  (load ≈ 12)
    --          -> B wins, workload is shared by people, not by table count.
    -- Hard rules: only waiters, must be ON SHIFT, area match, under max_tables.
    SELECT s.id INTO v_best_waiter_id
    FROM public.staff s
    LEFT JOIN public.bills b
        ON b.waiter_id = s.id
        AND b.status IN ('open', 'settling')
        AND b.id != p_bill_id
    WHERE s.venue_id = v_bill.venue_id
        AND s.role = 'waiter'
        AND s.is_active = true
        AND EXISTS (
            SELECT 1 FROM public.staff_shifts ss
            WHERE ss.staff_id = s.id AND ss.status = 'active'
              AND ss.supervisor_approved = true
        )
        AND (s.area_assignment IS NULL OR s.area_assignment = v_table_area)
        AND (
            SELECT COUNT(*) FROM public.bills
            WHERE waiter_id = s.id
              AND status IN ('open', 'settling')
              AND id != p_bill_id
        ) < s.max_tables
    GROUP BY s.id, s.max_tables
    ORDER BY COALESCE(SUM(b.guest_count), 0) + 0.5 * COUNT(b.id) ASC,
             MIN(s.created_at) ASC
    LIMIT 1;

    IF v_best_waiter_id IS NOT NULL THEN
        UPDATE public.bills SET waiter_id = v_best_waiter_id, updated_at = now() WHERE id = p_bill_id;
    END IF;

    RETURN v_best_waiter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_or_create_table_session(
    p_venue_slug text,
    p_table_id uuid,
    p_token text,
    p_guest_name text,
    p_party_size integer
)
RETURNS TABLE (
    session_id uuid,
    session_token text,
    bill_id uuid,
    venue_id uuid,
    payment_model text,
    table_label text
) AS $$
#variable_conflict use_column
DECLARE
    v_venue_id uuid;
    v_payment_model text;
    v_table_label text;
    v_qr_token text;
    v_bill_id uuid;
    v_session_id uuid;
    v_session_token text;
BEGIN
    -- 1. Get and validate table/venue details
    SELECT t.venue_id, v.payment_model, t.table_label, t.qr_code_token
    INTO v_venue_id, v_payment_model, v_table_label, v_qr_token
    FROM public.tables t
    JOIN public.venues v ON t.venue_id = v.id
    WHERE t.id = p_table_id AND v.slug = p_venue_slug AND t.is_active = true AND v.is_active = true;

    IF v_venue_id IS NULL THEN
        RAISE EXCEPTION 'Table not found or venue is inactive';
    END IF;

    -- 2. Verify table verification token
    IF v_qr_token IS NULL OR v_qr_token != p_token THEN
        RAISE EXCEPTION 'Invalid table verification token';
    END IF;

    -- 3. Get or create active bill for this table session
    SELECT id INTO v_bill_id
    FROM public.bills
    WHERE table_id = p_table_id AND status = 'open' AND venue_id = v_venue_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_bill_id IS NULL THEN
        INSERT INTO public.bills (venue_id, table_id, status, payment_model, guest_count)
        VALUES (v_venue_id, p_table_id, 'open', v_payment_model, p_party_size)
        RETURNING id INTO v_bill_id;
    ELSE
        -- Update guest count aggregate if joining an existing bill
        UPDATE public.bills
        SET guest_count = guest_count + p_party_size
        WHERE id = v_bill_id;
    END IF;

    -- 4. Create customer session
    INSERT INTO public.customer_sessions (venue_id, table_id, bill_id, guest_name, party_size)
    VALUES (v_venue_id, p_table_id, v_bill_id, COALESCE(p_guest_name, 'User'), p_party_size)
    RETURNING id, customer_sessions.session_token INTO v_session_id, v_session_token;

    RETURN QUERY SELECT v_session_id, v_session_token, v_bill_id, v_venue_id, v_payment_model, v_table_label;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.find_or_create_customer(p_venue_id uuid, p_phone text, p_name text DEFAULT NULL)
RETURNS uuid AS $$
DECLARE
    v_profile_id uuid;
BEGIN
    SELECT id INTO v_profile_id FROM public.customer_profiles WHERE venue_id = p_venue_id AND phone = p_phone;
    IF v_profile_id IS NULL THEN
        INSERT INTO public.customer_profiles (venue_id, name, phone) VALUES (p_venue_id, p_name, p_phone) RETURNING id INTO v_profile_id;
    END IF;
    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_bills_venue_id ON public.bills(venue_id);
CREATE INDEX IF NOT EXISTS idx_bills_table_id ON public.bills(table_id);
CREATE INDEX IF NOT EXISTS idx_bills_waiter_id ON public.bills(waiter_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_order_submissions_bill_id ON public.order_submissions(bill_id);
CREATE INDEX IF NOT EXISTS idx_order_submissions_venue_id ON public.order_submissions(venue_id);
CREATE INDEX IF NOT EXISTS idx_order_submissions_status ON public.order_submissions(status);
CREATE INDEX IF NOT EXISTS idx_order_items_submission_id ON public.order_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_order_items_bill_id ON public.order_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_staff_venue_id ON public.staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON public.tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_venue_id ON public.inventory_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_venue_id ON public.customer_profiles(venue_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_reference ON public.payment_events(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_activity_logs_venue_id ON public.activity_logs(venue_id);
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- BYSEN â€” COMPLETE SETUP (ONE-TIME PASTE)
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
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ 0. DROP OLD VARIANTS (idempotent re-runs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Postgres refuses CREATE OR REPLACE when a function's return type
-- changed (e.g. an older script defined open_bill_overview with OUT
-- params). Dropping first makes every re-run work. Each function is
-- fully recreated below, so nothing is lost.



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

-- â”€â”€ A0. VENUE OWNER LINK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ A1. PIN STORAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- â”€â”€ Phone normaliser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Converts any Ghana phone (024â€¦, 233â€¦, +233â€¦) to +233XXXXXXXXX.
-- Used inside every staff auth RPC so format mismatches never cause
-- a sign-in failure.
CREATE OR REPLACE FUNCTION public.normalise_phone(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT CASE
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^233[0-9]{9}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^0[0-9]{9}$'
      THEN '+233' || substring(regexp_replace(p_phone, '[^0-9]', '', 'g') FROM 2)
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{9}$'
      THEN '+233' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE p_phone
  END;
$$;

-- Normalise all existing staff phone numbers to +233XXXXXXXXX
UPDATE public.staff
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

-- Same canonical form for the venue contact phone — the owner's sign-in
-- number and the RLS gate compare against it.
UPDATE public.venues
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

-- Staff auth is Supabase phone OTP (no PIN columns — they were removed
-- by the OTP migration). Staff read their own profile via the
-- get_staff_profile_by_phone SECURITY DEFINER function below, which
-- bypasses RLS. It never returns the PIN (there is none).

-- Phone lookup â€” safe, never returns the PIN. Also gives the venue
-- name so staff know which restaurant they are signing into.

-- First-time PIN setup. Only works if the staff row exists, is active,
-- and has NO pin yet (so no one can overwrite an existing PIN).
-- PIN must be 4â€“6 digits.

-- Sign in with phone + own PIN. Returns the staff member + their venue.

-- â”€â”€ A2. KITCHEN DISPLAY (active orders only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ A2b. STAFF PLACE ORDERS (own-PIN staff have no Supabase auth) â”€
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

-- â”€â”€ A3. CUSTOMERS SEE REAL ORDER STATUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Customers read own submissions" ON public.order_submissions;
CREATE POLICY "Customers read own submissions" ON public.order_submissions
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

DROP POLICY IF EXISTS "Customers read own items" ON public.order_items;
CREATE POLICY "Customers read own items" ON public.order_items
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

-- â”€â”€ B1. PLATFORM FEE ON PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS platform_fee numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS fee_settled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_fee_settled_idx
    ON public.payments (venue_id, fee_settled);

-- Fee formula: flat GHS by bill amount — the same tiered schedule
-- Paystack charges per transaction, so cash and online fees are unified.
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT CASE
        WHEN p_amount <= 50   THEN 1.00
        WHEN p_amount <= 100  THEN 2.00
        WHEN p_amount <= 150  THEN 3.00
        WHEN p_amount <= 200  THEN 4.00
        ELSE 5.00
    END::numeric(10,2);
$$;

-- â”€â”€ B2. CASH SETTLEMENT (waiter confirms the cash) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_bill_id uuid,
    p_amount numeric,
    p_staff_id uuid DEFAULT NULL,
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
    v_collected_by uuid := NULL;
    v_staff_name text := 'Staff';
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'amount');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    IF p_staff_id IS NOT NULL THEN
        SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
        IF FOUND THEN
            IF v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
                RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
            END IF;
            v_collected_by := v_staff.id;
            v_staff_name := v_staff.name;
        ELSE
            -- Check if it's the venue owner / manager
            IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_bill.venue_id AND owner_id = p_staff_id) THEN
                IF v_bill.waiter_id IS NOT NULL THEN
                    SELECT * INTO v_staff FROM public.staff WHERE id = v_bill.waiter_id LIMIT 1;
                    IF FOUND THEN
                        v_collected_by := v_staff.id;
                        v_staff_name := v_staff.name;
                    END IF;
                END IF;
            ELSE
                v_staff_name := 'Owner';
            END IF;
        END IF;
    ELSIF v_bill.waiter_id IS NOT NULL THEN
        SELECT * INTO v_staff FROM public.staff WHERE id = v_bill.waiter_id LIMIT 1;
        IF FOUND THEN
            v_collected_by := v_staff.id;
            v_staff_name := v_staff.name;
        END IF;
    END IF;

    v_fee := public.platform_fee_for(p_amount);

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, payer_name,
        collected_by, status, platform_fee, fee_settled
    )
    VALUES (
        v_bill.id, v_bill.venue_id, p_amount, 'cash',
        'CASH-' || upper(substr(md5(random()::text), 1, 8)),
        p_payer_name, v_collected_by, 'success', v_fee, false
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
    VALUES (v_bill.venue_id, 'staff', v_staff_name, 'cash_payment_recorded', 'bill', v_bill.id,
            jsonb_build_object('amount', p_amount, 'platform_fee', v_fee, 'remaining', GREATEST(v_new_paid - v_bill.total, 0)));

    RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'bill_status', v_status,
                              'remaining', GREATEST(v_bill.total - v_new_paid, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_payment(uuid, numeric, uuid, text) TO anon, authenticated, service_role;

-- â”€â”€ B3. WAITER-ONLY ORDER STATUS / CANCELLATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ B4. 20-MINUTE SESSION EXPIRY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    -- 1. Mark stale sessions expired (unchanged rule: active, >20 min, no orders)
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 2. Cancel the orphaned bill of any expired session, but only if it
    --    really is empty (no items, no successful payments) and still open.
    UPDATE public.bills b
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE b.status IN ('open', 'settling')
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.bill_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.bill_id = b.id AND p.status = 'success')
      AND EXISTS (
          SELECT 1 FROM public.customer_sessions cs
          WHERE cs.bill_id = b.id AND cs.status = 'expired'
      );

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

-- â”€â”€ B5. CLOSE BILL (waiter closes a table) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Any active staff member of the same venue can close a table:
--   - bill must be open/settling with NO successful payments
--   - bill â†’ cancelled, its sessions â†’ closed, pending items â†’ cancelled
CREATE OR REPLACE FUNCTION public.close_bill(
    p_bill_id uuid,
    p_staff_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND THEN RETURN false; END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.venue_id IS DISTINCT FROM v_staff.venue_id THEN
        RETURN false;
    END IF;

    IF v_bill.status NOT IN ('open', 'settling') THEN
        RETURN false;
    END IF;

    IF EXISTS (SELECT 1 FROM public.payments p WHERE p.bill_id = p_bill_id AND p.status = 'success') THEN
        RETURN false;
    END IF;

    UPDATE public.bills
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE id = p_bill_id;

    UPDATE public.customer_sessions
    SET status = 'closed', last_active_at = now()
    WHERE bill_id = p_bill_id AND status IN ('active', 'expired');

    UPDATE public.order_submissions
    SET status = 'cancelled', updated_at = now()
    WHERE bill_id = p_bill_id AND status IN ('pending', 'confirmed', 'preparing');

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'bill_closed', 'bill', p_bill_id::text,
            jsonb_build_object('subtotal', v_bill.subtotal, 'table_id', v_bill.table_id));

    RETURN true;
END;
$$;

-- â”€â”€ C1. STAFF MANAGEMENT (owner writes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Owner-only list, create staff, activate/deactivate. Staff auth is
-- Supabase phone OTP, so pin_set is always false (kept for UI compat).
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

-- Add a staff member. Auth is Supabase phone OTP (no PIN setup needed).
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

-- Edit a staff member (owner only). NULL params keep the current value.
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

-- â”€â”€ C2. MANAGER DASHBOARD HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- Per-order cash fee ledger (LiveOps): recent cash payments with their
-- table labels. platform_fee is recorded at payment time by
-- record_cash_payment(); fee_settled flips when the venue settles.
CREATE OR REPLACE FUNCTION public.recent_cash_fees(p_venue_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE(
    payment_id uuid, amount numeric, platform_fee numeric,
    fee_settled boolean, created_at timestamptz,
    table_number int, table_label text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.id, p.amount, p.platform_fee, p.fee_settled, p.created_at,
           t.table_number, t.table_label
    FROM public.payments p
    JOIN public.bills b ON b.id = p.bill_id
    JOIN public.tables t ON t.id = b.table_id
    WHERE p.venue_id = p_venue_id
      AND p.method = 'cash'
      AND p.status = 'success'
      AND p.platform_fee > 0
    ORDER BY p.created_at DESC
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.recent_cash_fees(uuid, int) TO anon, authenticated;

-- Sessions that landed but never ordered (waiters approach them).
CREATE OR REPLACE FUNCTION public.landed_without_orders(p_venue_id uuid)RETURNS TABLE(
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
-- v2: also returns last_activity_at + dwell_minutes (time since the
-- last order item or payment) for table-dwell alerts.
CREATE OR REPLACE FUNCTION public.open_bill_overview(p_venue_id uuid)
RETURNS TABLE(
    bill_id uuid, table_number int, table_label text, guests int,
    waiter_name text, total numeric, amount_paid numeric, age_minutes int,
    last_activity_at timestamptz, dwell_minutes int,
    is_merged bool, merged_into_bill_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT b.id, t.table_number, t.table_label, b.guest_count,
           s.name, b.total, b.amount_paid,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.created_at)) / 60))::int,
           b.last_activity_at,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.last_activity_at)) / 60))::int,
           COALESCE(b.is_merged, false), b.merged_into_bill_id
    FROM public.bills b
    JOIN public.tables t ON t.id = b.table_id
    LEFT JOIN public.staff s ON s.id = b.waiter_id
    WHERE b.venue_id = p_venue_id
      AND b.status IN ('open', 'settling')
    ORDER BY b.created_at;
$$;

-- Staff-safe venue setting reader. venue_settings RLS is owner-only;
-- waiter devices run as anon, so this SECURITY DEFINER reader shares
-- the dwell threshold (max_dwell_minutes, default 120).
CREATE OR REPLACE FUNCTION public.get_venue_setting(
    p_venue_id uuid,
    p_key text,
    p_default jsonb DEFAULT 'null'::jsonb
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT value FROM public.venue_settings WHERE venue_id = p_venue_id AND key = p_key),
        p_default
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_setting(uuid, text, jsonb) TO anon, authenticated;

-- â”€â”€ C3. TABLE OPERATIONS (transfer / merge / split) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    v_total := v_subtotal + v_service + v_vat;

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

-- â”€â”€ C4. STAFF SHIFT SUMMARY (waiter performance, via RPC) â”€â”€â”€â”€â”€â”€â”€
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
               'Table ' || lpad(t.table_number::text, 2, '0') || ' Â· ' || upper(p.method) AS label,
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

-- â”€â”€ C5. CUSTOMER RESERVATION LOOKUP (tickets tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ D. REALTIME (live updates â€” no polling) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- These are the tables the app subscribes to. If you ever add more,
-- repeat the pattern: SQL Editor â†’ `ALTER PUBLICATION supabase_realtime
-- ADD TABLE public.<name>;` (or toggle it in Dashboard â†’ Database â†’
-- Replication â†’ Realtime â†’ select the table â†’ Enable).
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

-- â”€â”€ E. PAYMENT HARDENING (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Backs up the verify-payment / paystack-webhook edge functions:
--   * UNIQUE payments.reference          â†’ insert-vs-dedupe is atomic
--     (both functions race for the same Paystack reference; without
--     this, a concurrent pair can double-credit a bill).
--   * UNIQUE payment_events.paystack_reference â†’ single audit row.
--   * Auto-close trigger                 â†’ close logic lives in the DB
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

-- â”€â”€ F. MANAGER WRITE POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ F2. VENUE BRANDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- DONE. Verify with:
--   SELECT name, phone, role FROM staff ORDER BY role;
--   SELECT public.get_staff_profile_by_phone('0240000001');
--   SELECT name, owner_id IS NOT NULL AS owner_linked FROM venues WHERE slug='velvet-lounge';
--   SELECT public.platform_fee_for(45), public.platform_fee_for(60), public.platform_fee_for(160), public.platform_fee_for(5000);
--     -- expect 1.00 | 2.00 | 4.00 | 5.00 (tiered ₵1–₵5, unified with Paystack)
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
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ================================================================
-- NightOS â€” Critical SQL Fixes
-- Run this in Supabase Dashboard â†’ SQL Editor
-- ================================================================




-- â”€â”€ FIX 2: RLS â€” anon INSERT on customer_sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Anon can create session" ON public.customer_sessions;
CREATE POLICY "Anon can create session"
  ON public.customer_sessions
  FOR INSERT
  WITH CHECK (true);


-- â”€â”€ FIX 3: RLS â€” anon INSERT on bills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Anon can create bill" ON public.bills;
CREATE POLICY "Anon can create bill"
  ON public.bills
  FOR INSERT
  WITH CHECK (true);


-- â”€â”€ FIX 4: RLS â€” anon INSERT on reservations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Anyone can create reservation" ON public.reservations;
CREATE POLICY "Anyone can create reservation"
  ON public.reservations
  FOR INSERT
  WITH CHECK (true);


-- â”€â”€ VERIFY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT proname FROM pg_proc WHERE proname = 'assign_waiter_to_bill';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename IN ('customer_sessions','bills','reservations')
--   ORDER BY tablename, policyname;
-- ================================================================
-- EMERGENCY FIX: Recreate the three staff auth functions.
-- Paste ALL of this into Supabase SQL Editor and click Run.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Normaliser (safe to re-run)
CREATE OR REPLACE FUNCTION public.normalise_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT CASE
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^233[0-9]{9}$'
      THEN '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^0[0-9]{9}$'
      THEN '+233' || substring(regexp_replace(p_phone, '[^0-9]', '', 'g') FROM 2)
    WHEN regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{9}$'
      THEN '+233' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE p_phone
  END;
$$;

-- Normalise all staff phones to +233 format
UPDATE public.staff
SET phone = public.normalise_phone(phone)
WHERE phone IS NOT NULL AND phone NOT LIKE '+233%';

-- VERIFY (run these after)
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('normalise_phone','get_staff_profile_by_phone','get_venue_by_staff_phone');
