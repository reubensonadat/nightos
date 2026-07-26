DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.customer_profiles CASCADE;
DROP TABLE IF EXISTS public.event_tickets CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
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
DROP TABLE IF EXISTS public.venue_staff CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.venue_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;

CREATE OR REPLACE FUNCTION public.compute_convenience_fee(subtotal numeric)
RETURNS numeric(10,2) AS $$
BEGIN
    RETURN CASE
        WHEN subtotal <= 50   THEN 1.00
        WHEN subtotal <= 100  THEN 2.00
        WHEN subtotal <= 150  THEN 3.00
        WHEN subtotal <= 200  THEN 4.00
        ELSE                       5.00
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean AS $$
DECLARE
    user_phone text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.venues WHERE id = target_venue_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    SELECT raw_user_meta_data->>'phone' INTO user_phone FROM auth.users WHERE id = auth.uid();
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id AND phone = user_phone AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    phone_number text,
    name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, phone_number, name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.venue_staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    role text NOT NULL CHECK (role IN ('manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier')),
    name text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT venue_staff_pkey PRIMARY KEY (id),
    CONSTRAINT venue_staff_venue_id_phone UNIQUE (venue_id, phone_number)
);
ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue owner can manage venue staff" ON public.venue_staff FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
CREATE POLICY "Venue staff can read venue staff" ON public.venue_staff FOR SELECT
    USING (public.is_venue_member(venue_id));

CREATE OR REPLACE FUNCTION public.get_venue_by_staff_phone(p_phone text)
RETURNS TABLE (venue_id uuid, role text, venue jsonb) AS $$
BEGIN
    RETURN QUERY
    SELECT vs.venue_id, vs.role, row_to_json(v.*)::jsonb AS venue
    FROM public.venue_staff vs
    JOIN public.venues v ON v.id = vs.venue_id
    WHERE RIGHT(REGEXP_REPLACE(vs.phone_number, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE RIGHT(REGEXP_REPLACE(phone_number, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
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
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tables_pkey PRIMARY KEY (id),
    CONSTRAINT tables_venue_id_table_number UNIQUE (venue_id, table_number)
);
ALTER TABLE public.tables ENABLE ROW LEVEL security;
CREATE POLICY "Venue staff can read tables" ON public.tables FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue owner can manage tables" ON public.tables FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role text NOT NULL DEFAULT 'waiter' CHECK (role IN ('owner', 'manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier')),
    pin text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    max_tables integer NOT NULL DEFAULT 6,
    area_assignment text,
    hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
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
    convenience_fee numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    amount_paid numeric(10,2) NOT NULL DEFAULT 0,
    is_merged boolean NOT NULL DEFAULT false,
    merged_into_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    CONSTRAINT bills_pkey PRIMARY KEY (id)
);
ALTER TABLE public.bills ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read bills" ON public.bills FOR SELECT USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update bills" ON public.bills FOR UPDATE USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue owner can manage bills" ON public.bills FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE TABLE IF NOT EXISTS public.order_submissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
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
    actor_type text NOT NULL CHECK (actor_type IN ('staff', 'system', 'customer')),
    actor_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);
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
        vat = ROUND((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id) * (SELECT COALESCE(vat_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id), 2),
        convenience_fee = public.compute_convenience_fee((SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id))
    WHERE b.id = v_bill_id;
    UPDATE public.bills b SET total = subtotal + service_charge + vat + convenience_fee WHERE b.id = v_bill_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_item_change
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill();

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

CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid AS $$
DECLARE
    v_venue_id uuid;
    v_table_id uuid;
    v_table_area text;
    v_guest_count integer;
    v_best_waiter_id uuid;
BEGIN
    SELECT venue_id, table_id, guest_count INTO v_venue_id, v_table_id, v_guest_count FROM public.bills WHERE id = p_bill_id;
    SELECT area INTO v_table_area FROM public.tables WHERE id = v_table_id;
    SELECT s.id INTO v_best_waiter_id
    FROM public.staff s
    LEFT JOIN public.bills b ON b.waiter_id = s.id AND b.status IN ('open', 'settling') AND b.id != p_bill_id
    WHERE s.venue_id = v_venue_id AND s.role = 'waiter' AND s.is_active = true
        AND EXISTS (SELECT 1 FROM public.staff_shifts ss WHERE ss.staff_id = s.id AND ss.status = 'active')
        AND (s.area_assignment IS NULL OR s.area_assignment = v_table_area)
        AND (SELECT COUNT(*) FROM public.bills WHERE waiter_id = s.id AND status IN ('open', 'settling')) < s.max_tables
    GROUP BY s.id, s.max_tables
    HAVING COALESCE(SUM(b.guest_count), 0) < 20
    ORDER BY COALESCE(SUM(b.guest_count), 0) ASC
    LIMIT 1;
    IF v_best_waiter_id IS NOT NULL THEN
        UPDATE public.bills SET waiter_id = v_best_waiter_id WHERE id = p_bill_id;
    END IF;
    RETURN v_best_waiter_id;
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
