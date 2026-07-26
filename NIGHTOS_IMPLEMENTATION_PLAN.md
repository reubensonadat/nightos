# NightOS — Nightclub POS & Management System
## Implementation Plan

**Revenue target:** GHS 500+/month by end of August (Phase 1 live)
**Fee model:** Paystack Subaccounts — `bearer: subaccount` + `transaction_charge`
**Stack:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime) + React 19 + Vite + Tailwind CSS 4
**Rule:** Trust the server. Never trust the browser.

---

# PART 0: SETUP SEQUENCE

This is the order you set things up, from zero to running:

```
Step 1:  Create Supabase project
Step 2:  Run DB schema SQL (Part 1)
Step 3:  Set up Supabase Auth (phone OTP + email/password)
Step 4:  Configure Paystack (create subaccount, get keys)
Step 5:  Deploy edge functions (Part 2)
Step 6:  Set environment variables in Supabase
Step 7:  Wire frontend screens (Part 3, Phase 1 first)
Step 8:  Test end-to-end: QR → Menu → Cart → Pay → Kitchen sees
Step 9:  Deploy to Cloudflare Pages
Step 10: Go live with 1 venue → iterate
```

---

# PART 1: DATABASE SCHEMA

## 1.1 Venues (Nightclub/Restaurant Accounts)

```sql
-- ============================================================
-- NIGHTOS Schema — Run in Supabase SQL Editor
-- All statements are idempotent (CREATE IF NOT EXISTS)
-- ============================================================

-- 1. VENUES
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
    payment_model text NOT NULL DEFAULT 'POSTPAY'
        CHECK (payment_model IN ('PREPAY', 'POSTPAY')),
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

-- Venue owner can read/update their venue
CREATE POLICY "Venue owner can manage"
    ON public.venues FOR ALL
    USING (auth.uid() = owner_id);

-- Public can read active venues (for QR scanning)
CREATE POLICY "Public can read active venues"
    ON public.venues FOR SELECT
    USING (is_active = true);

-- 2. VENUE SETTINGS (extensible key-value for per-venue config)
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
CREATE POLICY "Venue owner can manage settings"
    ON public.venue_settings FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
```

## 1.2 Tables & Floorplan

```sql
-- 3. TABLES (physical tables in the venue)
CREATE TABLE IF NOT EXISTS public.tables (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_number integer NOT NULL,
    table_label text NOT NULL, -- e.g. "T1", "VIP-01", "Bar-3"
    capacity integer NOT NULL DEFAULT 4,
    area text NOT NULL DEFAULT 'Main'
        CHECK (area IN ('Main', 'VIP', 'Lounge', 'Bar', 'Outdoor', 'Private')),
    pos_x integer, -- x position on floorplan (pixels)
    pos_y integer, -- y position on floorplan (pixels)
    qr_code_url text, -- generated QR code image URL
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tables_pkey PRIMARY KEY (id),
    CONSTRAINT tables_venue_id_table_number UNIQUE (venue_id, table_number)
);

ALTER TABLE public.tables ENABLE ROW LEVEL security;

CREATE POLICY "Venue staff can read tables"
    ON public.tables FOR SELECT
    USING (public.is_venue_member(venue_id));

CREATE POLICY "Venue owner can manage tables"
    ON public.tables FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
```

## 1.3 Staff & Roles

```sql
-- 4. STAFF
CREATE TABLE IF NOT EXISTS public.staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role text NOT NULL DEFAULT 'waiter'
        CHECK (role IN ('owner', 'manager', 'supervisor', 'waiter', 'kitchen', 'bar', 'cashier')),
    pin text NOT NULL, -- encrypted 4-digit PIN
    is_active boolean NOT NULL DEFAULT true,
    max_tables integer NOT NULL DEFAULT 6, -- max tables they can handle
    area_assignment text, -- optional: restrict to one area
    hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT staff_pkey PRIMARY KEY (id),
    CONSTRAINT staff_venue_id_phone UNIQUE (venue_id, phone)
);

ALTER TABLE public.staff ENABLE ROW LEVEL security;

CREATE POLICY "Venue owner can manage staff"
    ON public.staff FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

CREATE POLICY "Staff can read own venue staff list"
    ON public.staff FOR SELECT
    USING (public.is_venue_member(venue_id));

-- 5. STAFF SHIFTS
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    clock_in timestamptz NOT NULL DEFAULT now(),
    clock_out timestamptz,
    cash_balance_start numeric(10,2) NOT NULL DEFAULT 0,
    cash_balance_end numeric(10,2),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_break', 'closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT staff_shifts_pkey PRIMARY KEY (id)
);

ALTER TABLE public.staff_shifts ENABLE ROW LEVEL security;
CREATE POLICY "Staff can read own shifts"
    ON public.staff_shifts FOR SELECT
    USING (staff_id IN (SELECT id FROM public.staff WHERE phone = auth.jwt()->>'phone'));
```

## 1.4 Menu & Products

```sql
-- 6. MENU CATEGORIES
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
CREATE POLICY "Public can read menu categories"
    ON public.menu_categories FOR SELECT
    USING (is_active = true);
CREATE POLICY "Venue owner can manage categories"
    ON public.menu_categories FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

-- 7. PRODUCTS (menu items)
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
    station text NOT NULL DEFAULT 'kitchen'
        CHECK (station IN ('kitchen', 'bar', 'both')),
    tags jsonb DEFAULT '[]'::jsonb, -- ["Popular", "New", "Vegetarian"]
    abv text, -- alcohol by volume for drinks
    origin text, -- origin region for wines/spirits
    is_active boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

ALTER TABLE public.products ENABLE ROW LEVEL security;
CREATE POLICY "Public can read active products"
    ON public.products FOR SELECT
    USING (is_active = true AND is_archived = false);
CREATE POLICY "Venue owner can manage products"
    ON public.products FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

-- 8. MODIFIER GROUPS (e.g. "Ice", "Strength", "Side")
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
CREATE POLICY "Public can read modifier groups"
    ON public.modifier_groups FOR SELECT
    USING (true);

-- 9. MODIFIER OPTIONS (e.g. "Regular", "Light", "Extra" under "Ice")
CREATE TABLE IF NOT EXISTS public.modifier_options (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    price_delta numeric(10,2) NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    CONSTRAINT modifier_options_pkey PRIMARY KEY (id)
);

ALTER TABLE public.modifier_options ENABLE ROW LEVEL security;
CREATE POLICY "Public can read modifier options"
    ON public.modifier_options FOR SELECT
    USING (true);

-- 10. PRODUCT-MODIFIER JOIN (which products get which modifier groups)
CREATE TABLE IF NOT EXISTS public.product_modifiers (
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    CONSTRAINT product_modifiers_pkey PRIMARY KEY (product_id, group_id)
);

ALTER TABLE public.product_modifiers ENABLE ROW LEVEL security;
CREATE POLICY "Public can read product modifiers"
    ON public.product_modifiers FOR SELECT
    USING (true);
```

## 1.5 Bills & Orders (The Core)

```sql
-- 11. BILLS (open tab per table — the central account)
CREATE TABLE IF NOT EXISTS public.bills (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    waiter_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    guest_count integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'settling', 'paid', 'cancelled')),
    payment_model text NOT NULL DEFAULT 'POSTPAY'
        CHECK (payment_model IN ('PREPAY', 'POSTPAY')),
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

-- Bill RLS: venue members can read, customers can read their table's bill
CREATE POLICY "Venue members can read bills"
    ON public.bills FOR SELECT
    USING (public.is_venue_member(venue_id));

CREATE POLICY "Venue members can update bills"
    ON public.bills FOR UPDATE
    USING (public.is_venue_member(venue_id));

CREATE POLICY "Venue owner can manage bills"
    ON public.bills FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

-- 12. ORDER SUBMISSIONS (each time someone sends items to kitchen/bar)
CREATE TABLE IF NOT EXISTS public.order_submissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    guest_name text, -- optional: who placed this order
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')),
    station text NOT NULL DEFAULT 'kitchen'
        CHECK (station IN ('kitchen', 'bar', 'both')),
    priority boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_submissions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.order_submissions ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read submissions"
    ON public.order_submissions FOR SELECT
    USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update submissions"
    ON public.order_submissions FOR UPDATE
    USING (public.is_venue_member(venue_id));

-- 13. ORDER ITEMS (line items within a submission)
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.order_submissions(id) ON DELETE CASCADE,
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name text NOT NULL, -- snapshot of product name at order time
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL, -- price at time of order
    modifier_snapshot jsonb DEFAULT '[]'::jsonb, -- snapshot of selected modifiers
    modifier_price_adjustment numeric(10,2) NOT NULL DEFAULT 0,
    line_total numeric(10,2) NOT NULL, -- computed: (unit_price + modifier_adjustment) * quantity
    notes text,
    guest_name text, -- optional: who ordered this item
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

ALTER TABLE public.order_items ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read order items"
    ON public.order_items FOR SELECT
    USING (public.is_venue_member(
        (SELECT venue_id FROM public.bills WHERE id = bill_id)
    ));

-- Trigger: update bill subtotal/total when order items change
CREATE OR REPLACE FUNCTION public.recalculate_bill()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    
    UPDATE public.bills b
    SET
        subtotal = (
            SELECT COALESCE(SUM(oi.line_total), 0)
            FROM public.order_items oi
            WHERE oi.bill_id = v_bill_id
        ),
        service_charge = ROUND(
            (SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id)
            * (SELECT COALESCE(service_charge_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id)
        , 2),
        vat = ROUND(
            (SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id)
            * (SELECT COALESCE(vat_pct, 0) / 100 FROM public.venues v JOIN public.bills b2 ON b2.venue_id = v.id WHERE b2.id = v_bill_id)
        , 2),
        convenience_fee = public.compute_convenience_fee(
            (SELECT COALESCE(SUM(oi.line_total), 0) FROM public.order_items oi WHERE oi.bill_id = v_bill_id)
        )
    WHERE b.id = v_bill_id;

    -- Recalculate total
    UPDATE public.bills b
    SET total = subtotal + service_charge + vat + convenience_fee
    WHERE b.id = v_bill_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_item_change
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_bill();
```

## 1.6 Payments

```sql
-- 14. PAYMENTS (individual payments against a bill)
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    method text NOT NULL
        CHECK (method IN ('mobile_money', 'card', 'bank_transfer', 'digital_wallet', 'cash')),
    reference text, -- Paystack reference or cash receipt number
    payer_name text, -- who paid
    collected_by uuid REFERENCES public.staff(id), -- staff who collected cash payment
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    paystack_data jsonb, -- raw Paystack response (for auditing)
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payments_pkey PRIMARY KEY (id)
);

ALTER TABLE public.payments ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read payments"
    ON public.payments FOR SELECT
    USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue staff can insert payments"
    ON public.payments FOR INSERT
    WITH CHECK (public.is_venue_member(venue_id));

-- Trigger: update bill.amount_paid and auto-close bill when paid in full
CREATE OR REPLACE FUNCTION public.update_bill_payment()
RETURNS trigger AS $$
DECLARE
    v_bill_id uuid;
    v_total numeric(10,2);
    v_paid numeric(10,2);
BEGIN
    IF NEW.status = 'success' THEN
        v_bill_id := NEW.bill_id;

        UPDATE public.bills b
        SET amount_paid = amount_paid + NEW.amount
        WHERE b.id = v_bill_id;

        SELECT total, amount_paid INTO v_total, v_paid
        FROM public.bills WHERE id = v_bill_id;

        IF v_paid >= v_total THEN
            UPDATE public.bills
            SET status = 'paid', closed_at = now()
            WHERE id = v_bill_id;
        ELSIF v_paid > 0 THEN
            UPDATE public.bills
            SET status = 'settling'
            WHERE id = v_bill_id AND status = 'open';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_success
    AFTER INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_bill_payment();

-- 15. PAYMENT EVENTS (idempotency gate for Paystack webhooks)
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
CREATE POLICY "Service role can manage payment_events"
    ON public.payment_events FOR ALL
    USING (true)
    WITH CHECK (true);
```

## 1.7 Inventory

```sql
-- 16. INVENTORY ITEMS
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
CREATE POLICY "Venue owner can manage inventory"
    ON public.inventory_items FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
CREATE POLICY "Venue staff can read inventory"
    ON public.inventory_items FOR SELECT
    USING (public.is_venue_member(venue_id));

-- 17. INVENTORY TRANSACTIONS (audit trail for stock movements)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    qty_change numeric(10,2) NOT NULL, -- negative = deduction, positive = addition
    reason text NOT NULL
        CHECK (reason IN ('sale', 'restock', 'waste', 'spoilage', 'adjustment', 'variance')),
    reference_id text, -- order_id or invoice_id for sales
    notes text,
    created_by uuid REFERENCES public.staff(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL security;
CREATE POLICY "Venue owner can manage transactions"
    ON public.inventory_transactions FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
```

## 1.8 Reservations, Tickets & CRM

```sql
-- 18. RESERVATIONS
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
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')),
    deposit_amount numeric(10,2) NOT NULL DEFAULT 0,
    deposit_paid boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reservations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.reservations ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can manage reservations"
    ON public.reservations FOR ALL
    USING (public.is_venue_member(venue_id));
CREATE POLICY "Public can create reservations"
    ON public.reservations FOR INSERT
    WITH CHECK (true);

-- 19. EVENT TICKETS
CREATE TABLE IF NOT EXISTS public.event_tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    event_name text NOT NULL,
    event_date date NOT NULL,
    event_time time NOT NULL,
    ticket_type text NOT NULL, -- "Regular", "VIP", "VVIP"
    price numeric(10,2) NOT NULL,
    quantity_total integer NOT NULL DEFAULT 0,
    quantity_sold integer NOT NULL DEFAULT 0,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_tickets_pkey PRIMARY KEY (id)
);

ALTER TABLE public.event_tickets ENABLE ROW LEVEL security;
CREATE POLICY "Public can read active tickets"
    ON public.event_tickets FOR SELECT
    USING (is_active = true);

-- 20. CUSTOMER PROFILES (auto-created from phone on checkout)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text,
    phone text,
    email text,
    total_visits integer NOT NULL DEFAULT 0,
    total_spend numeric(10,2) NOT NULL DEFAULT 0,
    loyalty_tier text NOT NULL DEFAULT 'new'
        CHECK (loyalty_tier IN ('new', 'regular', 'loyal', 'vip')),
    is_vip boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customer_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT customer_profiles_venue_id_phone UNIQUE (venue_id, phone)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL security;
CREATE POLICY "Venue members can read customer profiles"
    ON public.customer_profiles FOR SELECT
    USING (public.is_venue_member(venue_id));
CREATE POLICY "Venue members can update customer profiles"
    ON public.customer_profiles FOR UPDATE
    USING (public.is_venue_member(venue_id));
CREATE POLICY "Public can upsert their own profile"
    ON public.customer_profiles FOR INSERT
    WITH CHECK (true);
```

## 1.9 Expenses & Activity Logs

```sql
-- 21. EXPENSES
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
CREATE POLICY "Venue owner can manage expenses"
    ON public.expenses FOR ALL
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));

-- 22. ACTIVITY LOGS (audit trail)
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
CREATE POLICY "Venue owner can read logs"
    ON public.activity_logs FOR SELECT
    USING (auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id));
```

## 1.10 Helper Functions

```sql
-- ============================================================
-- HELPER FUNCTIONS & RPCs
-- ============================================================

-- Convenience fee computation (server-side source of truth)
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

-- Check if user is a venue member (owner OR staff)
CREATE OR REPLACE FUNCTION public.is_venue_member(target_venue_id uuid)
RETURNS boolean AS $$
DECLARE
    user_phone text;
BEGIN
    -- Check if owner
    IF EXISTS (SELECT 1 FROM public.venues WHERE id = target_venue_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;

    -- Get phone from auth users metadata
    SELECT raw_user_meta_data->>'phone'
    INTO user_phone
    FROM auth.users
    WHERE id = auth.uid();

    -- Check if staff with this phone works at this venue
    RETURN EXISTS (
        SELECT 1 FROM public.staff
        WHERE venue_id = target_venue_id
        AND phone = user_phone
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get staff member by phone
CREATE OR REPLACE FUNCTION public.get_staff_by_phone(p_phone text)
RETURNS TABLE (
    id uuid,
    venue_id uuid,
    name text,
    role text,
    venue_name text,
    venue_slug text
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.venue_id, s.name, s.role, v.name, v.slug
    FROM public.staff s
    JOIN public.venues v ON v.id = s.venue_id
    WHERE s.phone = p_phone AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign waiter to bill (load-based algorithm)
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid AS $$
DECLARE
    v_venue_id uuid;
    v_table_id uuid;
    v_table_area text;
    v_guest_count integer;
    v_best_waiter_id uuid;
BEGIN
    SELECT venue_id, table_id, guest_count INTO v_venue_id, v_table_id, v_guest_count
    FROM public.bills WHERE id = p_bill_id;

    SELECT area INTO v_table_area FROM public.tables WHERE id = v_table_id;

    -- Find waiter with lowest current load (sum of guest_count on open bills)
    SELECT s.id INTO v_best_waiter_id
    FROM public.staff s
    LEFT JOIN public.bills b ON b.waiter_id = s.id
        AND b.status IN ('open', 'settling')
        AND b.id != p_bill_id
    WHERE s.venue_id = v_venue_id
        AND s.role = 'waiter'
        AND s.is_active = true
        AND EXISTS (
            SELECT 1 FROM public.staff_shifts ss
            WHERE ss.staff_id = s.id AND ss.status = 'active'
        )
        AND (s.area_assignment IS NULL OR s.area_assignment = v_table_area)
        AND (
            SELECT COUNT(*) FROM public.bills
            WHERE waiter_id = s.id AND status IN ('open', 'settling')
        ) < s.max_tables
    GROUP BY s.id, s.max_tables
    HAVING COALESCE(SUM(b.guest_count), 0) < 20 -- safety cap
    ORDER BY COALESCE(SUM(b.guest_count), 0) ASC
    LIMIT 1;

    IF v_best_waiter_id IS NOT NULL THEN
        UPDATE public.bills SET waiter_id = v_best_waiter_id WHERE id = p_bill_id;
    END IF;

    RETURN v_best_waiter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or find customer profile
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
    p_venue_id uuid,
    p_phone text,
    p_name text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_profile_id uuid;
BEGIN
    SELECT id INTO v_profile_id
    FROM public.customer_profiles
    WHERE venue_id = p_venue_id AND phone = p_phone;

    IF v_profile_id IS NULL THEN
        INSERT INTO public.customer_profiles (venue_id, name, phone)
        VALUES (p_venue_id, p_name, p_phone)
        RETURNING id INTO v_profile_id;
    END IF;

    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 1.11 Indexes for Performance

```sql
-- ============================================================
-- INDEXES (speed up common queries)
-- ============================================================

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
```

---

# PART 2: EDGE FUNCTIONS

All edge functions are Deno TypeScript running on Supabase. They use `service_role` for DB writes (never trust the browser).

## 2.1 Shared: Fee Computation (`_shared/fees.ts`)

```typescript
// supabase/functions/_shared/fees.ts
// Server-side source of truth for fee calculation

export function computeConvenienceFee(subtotal: number): number {
    if (subtotal <= 50)   return 1.00
    if (subtotal <= 100)  return 2.00
    if (subtotal <= 150)  return 3.00
    if (subtotal <= 200)  return 4.00
    return 5.00 // cap
}

export function computeBillTotal(
    subtotal: number,
    serviceChargePct: number,
    vatPct: number
): { subtotal: number; serviceCharge: number; vat: number; fee: number; total: number } {
    const fee = computeConvenienceFee(subtotal)
    const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100
    const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100
    const total = subtotal + serviceCharge + vat + fee
    return { subtotal, serviceCharge, vat, fee, total }
}
```

## 2.2 Paystack Webhook (`paystack-webhook/index.ts`)

**Purpose:** Receive payment confirmations from Paystack. Verify HMAC signature. Update bill status.

```
File:    supabase/functions/paystack-webhook/index.ts
Trigger: Called by Paystack when charge.success or invoice.payment_succeeded

Flow:
  1. Read x-paystack-signature header
  2. Compute HMAC-SHA512 of raw body using PAYSTACK_SECRET_KEY
  3. If signature mismatch → return 401
  4. Parse event type
  5. If charge.success:
     a. Extract bill_id from metadata
     b. Check payment_events for idempotency (skip if already processed)
     c. Verify amount against expected total (from DB bill.total)
     d. If amount mismatch → log to payment_events, return 200 (don't retry)
     e. Insert payment record with status=success
     f. Log to payment_events
  6. Return 200
```

**Security layers:**
- HMAC-SHA512 signature verification
- Idempotency gate (payment_events table, unique on reference)
- Amount verification (server-side: fetched bill.total from DB, compared against Paystack's `data.amount`)
- `service_role` key used for DB writes (bypasses RLS)

## 2.3 Verify Payment (`verify-payment/index.ts`)

**Purpose:** Called from the frontend after Paystack popup succeeds. Double-check with Paystack API.

```
File:    supabase/functions/verify-payment/index.ts
Called:  From frontend on Paystack onSuccess callback

Flow:
  1. Receive { reference, bill_id } from client
  2. Call Paystack API: GET /transaction/verify/{reference}
  3. If Paystack says status != success → return 400
  4. Idempotency check (payment_events)
  5. Fetch bill from DB, re-compute expected total
  6. If amount paid != expected total → return 400 (anti-forge)
  7. Insert payment record with status=success
  8. Log to payment_events
  9. Return { success: true, newStatus: "paid" }
```

## 2.4 Assign Waiter (`assign-waiter/index.ts`)

**Purpose:** Find the best waiter for a bill (POSTPAY model).

```
File:    supabase/functions/assign-waiter/index.ts
Called:  When a POSTPAY bill receives its first order submission

Algorithm:
  1. Get all waiters ON SHIFT at this venue
  2. Filter by area if table has area restriction
  3. For each waiter:
     load = SUM(guest_count) from all their open bills
     table_count = COUNT of their open bills
  4. Exclude waiters at max_tables
  5. Pick waiter with lowest load (tiebreak: lowest table_count)
  6. Update bill.waiter_id
  7. Return { waiter_id, waiter_name }
```

**RPC alternative:** The `assign_waiter_to_bill()` SQL function in the schema can serve the same purpose without a separate edge function. Use the SQL function for simplicity, or an edge function if you need to notify the waiter via push notification.

## 2.5 Staff Clock In/Out

```
File:    supabase/functions/staff-clock-in/index.ts
Called:  Staff taps "Start Shift"

Flow:
  1. Verify staff PIN
  2. Check no other active shift exists
  3. Create staff_shifts record with clock_in = now()
  4. Return shift data

File:    supabase/functions/staff-clock-out/index.ts
Called:  Staff taps "End Shift"

Flow:
  1. Find active shift
  2. Calculate:
     - Total hours worked
     - Total sales on waiter's bills
     - Total tips received
     - Tables served count
     - Cash balance reconciliation
  3. Update shift with clock_out and end cash balance
  4. Insert activity_log entry
  5. Return shift summary
```

---

# PART 3: FRONTEND WIRING

## 3.1 What Changes Per Screen

| Screen | File | What Changes |
|---|---|---|
| **WelcomeScreen** | `src/screens/WelcomeScreen.tsx` | Read venue/brand settings from Supabase instead of hardcoded. Skeleton loading while fetching. |
| **MenuScreen** | `src/screens/MenuScreen.tsx` | Fetch products + modifiers from Supabase instead of `menu.ts`. Cart remains same. |
| **ItemDetailsSheet** | `src/components/ItemDetailsSheet.tsx` | Fetch modifier groups from Supabase based on product-modifier joins. |
| **CartScreen** | `src/screens/CartScreen.tsx` | "Send" button creates order_submission + order_items in Supabase. Call `assign-waiter` RPC for POSTPAY. Call Paystack popup for PREPAY. |
| **OrderTrackingScreen** | `src/screens/OrderTrackingScreen.tsx` | Subscribe to Realtime on `order_submissions` to show live status updates. |
| **CheckoutScreen** | `src/screens/CheckoutScreen.tsx` | For PREPAY: Paystack popup → call `verify-payment`. For POSTPAY: Fetch bill total, show split options, process payments. |
| **ReservationsScreen** | `src/screens/ReservationsScreen.tsx` | Write to `reservations` table. Read `event_tickets` for ticket sales. |
| **StaffAuthScreen** | `src/screens/waiter/StaffAuthScreen.tsx` | Auth against Supabase with phone + PIN. Use `get_staff_by_phone` RPC. |
| **TablesDashboard** | `src/screens/waiter/TablesDashboard.tsx` | Fetch tables + open bills from Supabase. Real-time subscription for bill updates. |
| **OrderManagementScreen** | `src/screens/waiter/OrderManagementScreen.tsx` | Add items to bill (post to `order_submissions` + `order_items`). Confirm pending orders. |
| **TableOperationsScreen** | `src/screens/waiter/TableOperationsScreen.tsx` | Call `merge-tables` edge function or update `bills.merged_into_bill_id`. Split bill by item/even/amount (client-side calc, server-side execution). |
| **InvoiceSettlementScreen** | `src/screens/waiter/InvoiceSettlementScreen.tsx` | Fetch bill total and payments. Cash settlement: enter amount received, show change. Card/MoMo: generate Paystack payment link. |
| **ShiftPerformanceScreen** | `src/screens/waiter/ShiftPerformanceScreen.tsx` | Fetch from `staff_shifts` aggregated data. |
| **KitchenDisplayScreen** | `src/screens/kitchen/KitchenDisplayScreen.tsx` | Subscribe to Realtime on `order_submissions` where venue_id matches and station matches. Update status. |
| **LiveOpsScreen** | `src/screens/manager/LiveOpsScreen.tsx` | Fetch real-time counts from Supabase (open bills, revenue today, active staff). |
| **FloorplanScreen** | `src/screens/manager/FloorplanScreen.tsx` | Fetch tables from Supabase. Generate QR codes server-side. |
| **MenuManagerScreen** | `src/screens/manager/MenuManagerScreen.tsx` | Full CRUD against `products`, `menu_categories`, `modifier_groups`, `modifier_options`. |
| **StaffManagerScreen** | `src/screens/manager/StaffManagerScreen.tsx` | Full CRUD against `staff`. View active shifts. |
| **FinancialReportsScreen** | `src/screens/manager/FinancialReportsScreen.tsx` | Fetch from real `bills`, `payments`, `expenses`. Compute on server or client. |
| **CrmScreen** | `src/screens/manager/CrmScreen.tsx` | Fetch from `customer_profiles`. Enable SMS campaign composition. |

## 3.2 New Files Needed

```
src/
├── lib/
│   ├── supabase.ts          # Supabase client initialization
│   ├── api.ts               # All API calls (edge functions, queries)
│   ├── fees.ts              # Client-side fee display (mirrors server, for UI only)
│   └── utils.ts             # formatGHS, generateOrderRef, etc.
├── hooks/
│   ├── useVenue.ts          # Fetch venue by slug
│   ├── useBill.ts           # Fetch/open bill for a table
│   ├── useOrders.ts         # Subscribe to order_submissions for a venue
│   ├── useStaff.ts          # Staff authentication + profile
│   └── useRealtime.ts       # Generic Supabase Realtime hook
└── components/
    ├── SplitBillModal.tsx    # Bill split UI (by item, even, custom)
    └── PaystackButton.tsx    # Paystack payment popup component
```

## 3.3 Skeleton Loading (index.html)

Add this to `index.html` inside the `<div id="root">`:

```html
<div id="skeleton" style="
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100svh; background: #0a0a0a; color: #c9a96e; font-family: system-ui;
    gap: 16px;
">
    <div style="width: 48px; height: 48px; border: 3px solid rgba(201,169,110,0.2); border-top-color: #c9a96e; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    <p style="font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6;">Loading Velvet Lounge</p>
</div>
<style>
    @keyframes spin { to { transform: rotate(360deg); } }
</style>
```

Remove it in `main.tsx` after React mounts:

```typescript
const skeleton = document.getElementById('skeleton')
if (skeleton) skeleton.remove()
```

---

# PART 4: PHASED TIMELINE

## Phase 1: Money Flow (11 Days — July 25 → Aug 5)

**Goal:** Customer can scan QR, order, pay via Paystack, kitchen/waiter sees it.

| Day | Task | Who | Depends On |
|---|---|---|---|
| 1 | Create Supabase project, set up DB schema (run all SQL) | Backend | — |
| 2 | Set up Supabase Auth (phone OTP, email/password), configure providers | Backend | Day 1 |
| 3 | Implement `_shared/fees.ts` + `paystack-webhook` edge function | Backend | Day 1 |
| 4 | Implement `verify-payment` edge function + `assign_waiter_to_bill` SQL function | Backend | Day 3 |
| 5 | Create subaccount in Paystack dashboard, configure webhook URL | Backend | Day 3 |
| 6 | Wire WelcomeScreen + MenuScreen to Supabase (fetch venue, products, modifiers) | Frontend A | Day 1 |
| 7 | Wire CartScreen: send order to Supabase + Paystack popup for PREPAY | Frontend A | Day 4-5 |
| 8 | Waiter auth screen (phone + PIN) + TablesDashboard (fetch open bills) | Frontend A | Day 2 |
| 9 | Kitchen KDS: subscribe to Realtime, show incoming PAID orders | Frontend B | Day 6 |
| 10 | End-to-end testing: QR → menu → cart → Paystack → kitchen sees order | Both | Day 1-9 |
| 11 | Bug fixes, deploy to Cloudflare Pages, go live with 1 venue | Both | Day 10 |

**Phase 1 Deliverables:**
- Working PREPAY ordering flow
- Paystack fee collection live (GHS 1-5 per transaction)
- Waiter can see table and confirm order
- Kitchen can see and update order status
- Skeleton loading in index.html
- RLS security on all tables

## Phase 2: Operations (14 Days — Aug 6 → Aug 19)

**Goal:** Full POSTPAY flow, waiter tools, inventory, KDS, staff performance.

| Day | Task | Who | Depends On |
|---|---|---|---|
| 12 | POSTPAY flow: send order without payment, auto-assign waiter | Frontend A | Phase 1 |
| 13 | Wire OrderManagementScreen: add items, confirm orders, status updates | Frontend A | Day 12 |
| 14 | Wire TableOperationsScreen: transfer table, merge tables | Frontend A | Day 12 |
| 15 | Split bill UI + backend (by item, even, custom) | Frontend A + Backend | Day 14 |
| 16 | Wire InvoiceSettlementScreen: cash, MoMo, card payments | Frontend A | Day 12 |
| 17 | Wire OrderTrackingScreen: real-time status for customer | Frontend A | Day 13 |
| 18 | Bar station routing: filter KDS by station=bar, add bar screen | Frontend B | Phase 1 |
| 19 | Kitchen/Bar urgency timers, priority orders, sound notifications | Frontend B | Day 18 |
| 20 | Inventory: auto-deduct on confirmed orders, low-stock alerts | Backend + Frontend B | Day 12 |
| 21 | Stock count module + variance reporting | Backend + Frontend B | Day 20 |
| 22 | Wire ShiftPerformanceScreen: real sales/tables/tips data | Frontend A | Day 12 |
| 23 | Digital receipts (SMS via mNotify, WhatsApp link, email) | Backend | Day 12 |
| 24 | Testing: all POSTPAY flows, edge cases, cash handling | Both | Day 12-23 |
| 25 | Bug fixes, deploy Phase 2 | Both | Day 24 |

**Phase 2 Deliverables:**
- POSTPAY flow (order → waiter assigns → kitchen → serve → pay)
- Table operations (transfer, merge, split by item/even/custom)
- Bill settlement (cash with change, MoMo, card)
- Kitchen + Bar KDS with real-time status and urgency timers
- Inventory tracking with auto-deduct and stock count
- Staff shift performance with real metrics
- Digital receipts

## Phase 3: Management & Growth (14 Days — Aug 20 → Sep 2)

**Goal:** Manager dashboard, CRM, reservations, financials.

| Day | Task | Who | Depends On |
|---|---|---|---|
| 26 | Wire LiveOpsScreen: real-time KPIs, open bills, revenue today | Frontend B | Phase 2 |
| 27 | Wire FloorplanScreen: table layout from DB, QR code generation | Frontend B | Phase 1 |
| 28 | Wire FinancialReportsScreen: real P&L from bills/payments/expenses | Frontend B | Phase 2 |
| 29 | Wire MenuManagerScreen: CRUD against real Supabase tables | Frontend B | Phase 1 |
| 30 | Wire StaffManagerScreen: CRUD, shift management, role permissions | Frontend B | Phase 1 |
| 31 | Wire CrmScreen: customer profiles, visit history, spending | Frontend B | Phase 2 |
| 32 | Reservations: table booking, event ticket sales, QR entry validation | Frontend A + Backend | Phase 2 |
| 33 | Marketing: SMS campaigns to customer segments, birthday promos | Backend + Frontend B | Day 31 |
| 34 | End-of-day procedures: cash reconciliation, stock variance, shift close | Backend + Frontend B | Day 25 |
| 35 | Multi-branch schema readiness (venue selection UI) | Frontend B | Day 26 |
| 36 | Testing: all Phase 3 flows, load testing, security audit | Both | Day 26-35 |
| 37 | Bug fixes, deploy Phase 3 | Both | Day 36 |
| 38 | Production monitoring, first venue support | Both | Day 37 |

**Phase 3 Deliverables:**
- Manager dashboard with live data
- Floorplan with QR code download per table
- Financial reports (P&L, AOV, staff/product performance)
- Menu + Staff + Inventory CRUD wired to Supabase
- CRM with customer profiles and visit history
- Reservations and event ticketing
- SMS marketing
- End-of-day procedures

---

# PART 5: TASK DELEGATION

## Backend (You) — Full Ownership

```
Phase 1:
  - Supabase project setup
  - Run DB schema SQL
  - Configure Auth (phone OTP, email/password)
  - Write _shared/fees.ts
  - Write paystack-webhook edge function (HMAC + idempotency + anti-forge)
  - Write verify-payment edge function
  - Write assign_waiter_to_bill SQL function
  - Write find_or_create_customer SQL function
  - Setup Paystack subaccount + webhook in dashboard
  - Set environment variables in Supabase
  - CORS configuration
  - Deploy edge functions

Phase 2:
  - Inventory auto-deduct trigger (on order confirmed)
  - Stock count + variance SQL
  - SMS service integration (mNotify)
  - Digital receipt generation
  - Activity log trigger

Phase 3:
  - Reservation + ticketing backend
  - Marketing SMS campaign backend
  - End-of-day aggregation queries
  - Security audit + RLS review
```

## Frontend A (Friend 1) — Customer + Waiter Screens

```
Phase 1:
  - Wire WelcomeScreen (fetch venue from slug)
  - Wire MenuScreen (fetch products from Supabase)
  - Wire ItemDetailsSheet (fetch modifiers)
  - Wire CartScreen (POST order_submission + order_items)
  - Add Paystack popup integration
  - Wire StaffAuthScreen (phone + PIN login)
  - Wire TablesDashboard (fetch tables + open bills)

Phase 2:
  - Wire OrderManagementScreen (add items, confirm → send to kitchen)
  - Wire TableOperationsScreen (transfer, merge)
  - Wire SplitBillModal (by item, even, custom)
  - Wire InvoiceSettlementScreen (cash, MoMo, card)
  - Wire OrderTrackingScreen (real-time subscription)
  - Wire ShiftPerformanceScreen (real data)
  - Wire ReservationsScreen (customer-side)

Phase 3:
  - Wire ReservationsScreen (full)
  - Event ticket purchase flow
```

## Frontend B (Friend 2) — Kitchen + Manager Screens

```
Phase 1:
  - Wire KitchenDisplayScreen (Realtime subscription, status updates)
  - Skeleton loading in index.html + removal on mount

Phase 2:
  - Bar display screen (filtered KDS)
  - Urgency timers + sound notifications
  - Wire MenuManagerScreen (CRUD)
  - Wire StaffManagerScreen (CRUD + shifts)

Phase 3:
  - Wire LiveOpsScreen (real-time KPIs)
  - Wire FloorplanScreen (table layout, QR codes)
  - Wire FinancialReportsScreen (real data)
  - Wire CrmScreen (customer profiles)
  - Wire BrandSettingsScreen (save to venue_settings)
  - Venue selection (multi-branch)
  - End-of-day UI
  - Marketing campaign UI
```

---

# PART 6: PAYSTACK SUBACCOUNT SETUP

## 6.1 Create Subaccount in Paystack Dashboard

1. Log into Paystack dashboard
2. Go to Settings → Subaccounts → Create Subaccount
3. Business name: `NightOS Platform`
4. Bank account: Your settlement account
5. Percentage: `0` (we use `transaction_charge` instead)
6. `bearer`: `subaccount` (merchant pays gateway fees)
7. Save → get `subaccount_code`

## 6.2 Fee Structure in Code

The fee is computed server-side in `_shared/fees.ts` and in the `compute_convenience_fee()` SQL function. Both must match exactly.

```typescript
function computeConvenienceFee(subtotal: number): number {
    if (subtotal <= 50)   return 1.00
    if (subtotal <= 100)  return 2.00
    if (subtotal <= 150)  return 3.00
    if (subtotal <= 200)  return 4.00
    return 5.00
}
```

## 6.3 Paystack Transaction Initialization (Frontend)

When initializing a Paystack transaction for a PREPAY order:

```javascript
const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: customerEmail || `${tableId}@nightos.com`,
    amount: (billTotal + convenienceFee) * 100, // in pesewas
    currency: 'GHS',
    ref: generatedReference,
    subaccount: SUBACCOUNT_CODE,
    transaction_charge: convenienceFee * 100, // your fee in pesewas
    bearer: 'subaccount', // merchant pays the gateway fee
    metadata: {
        bill_id: billId,
        venue_id: venueId,
        custom_fields: [
            { variable_name: 'bill_id', value: billId }
        ]
    },
    callback: (response) => {
        // Call verify-payment edge function
        fetch(`${SUPABASE_URL}/functions/v1/verify-payment`, {
            method: 'POST',
            body: JSON.stringify({
                reference: response.reference,
                bill_id: billId
            })
        })
    },
    onClose: () => { /* handle popup closed */ }
})
handler.openIframe()
```

---

# PART 7: DEPLOYMENT CHECKLIST

```
[ ] Supabase project created
[ ] DB schema SQL executed successfully
[ ] Auth providers configured (phone, email)
[ ] Paystack subaccount created
[ ] Paystack webhook URL pointed to edge function
[ ] Environment variables set in Supabase:
    - PAYSTACK_SECRET_KEY
    - PAYSTACK_PUBLIC_KEY
    - PAYSTACK_SUBACCOUNT_CODE
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - CORS_ORIGIN (your frontend domain)
[ ] Edge functions deployed (supabase functions deploy)
[ ] Cloudflare Pages project created
[ ] Build command set (npm run build)
[ ] Environment variables set in Cloudflare
[ ] Custom domain configured
[ ] SSL enabled
[ ] Test transaction: send GHS 1, confirm webhook fires
[ ] Test transaction: verify fee appears in Paystack split
[ ] Test transaction: confirm bill marked PAID
```

---

# PART 8: REVENUE PROJECTION

At GHS 500/month target with your fee model:

| Scenario | Orders/Day | Avg Fee | Daily | Monthly |
|---|---|---|---|---|
| Conservative | 10 | GHS 2.50 | GHS 25 | GHS 750 |
| Moderate | 20 | GHS 3.00 | GHS 60 | GHS 1,800 |
| Aggressive | 30 | GHS 3.50 | GHS 105 | GHS 3,150 |

With 3 venues each doing 10-15 orders/night at your bracket pricing, GHS 500/month is achievable in the first month. Scale is linear with venues.

---

# END OF PLAN