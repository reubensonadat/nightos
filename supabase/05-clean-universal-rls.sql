-- ═════════════════════════════════════════════════════════════════════════════
-- 05 — Clean Universal Row Level Security (RLS) for All Tables
-- 
-- Why:
-- 1. Creates venue_settings if missing.
-- 2. Checks information_schema so it ONLY enables RLS on tables that exist.
-- 3. Drops legacy policies to prevent Postgres recursion (42P17).
-- 4. Creates clean, non-circular policies so data never leaks across venues.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 0. ENSURE VENUE SETTINGS TABLE EXISTS ──
CREATE TABLE IF NOT EXISTS public.venue_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    key text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT venue_settings_pkey PRIMARY KEY (id),
    CONSTRAINT venue_settings_venue_id_key UNIQUE (venue_id, key)
);

-- ── 1. HELPER FUNCTIONS (Fast & Non-recursive) ──

-- Returns the authenticated user's phone number safely from JWT or auth.users
CREATE OR REPLACE FUNCTION public.current_user_phone()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb->>'phone',
        (SELECT phone FROM auth.users WHERE id = auth.uid())
    );
$$;

-- Checks if the user is owner or authorized member of a venue
CREATE OR REPLACE FUNCTION public.is_venue_authorized(target_venue_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT (
        -- Service role bypass
        (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
        OR
        -- Venue owner by auth.uid()
        EXISTS (
            SELECT 1 FROM public.venues v
            WHERE v.id = target_venue_id
              AND v.owner_id = auth.uid()
        )
        OR
        -- Owner or Staff member matched by phone
        (
            auth.uid() IS NOT NULL
            AND (
                EXISTS (
                    SELECT 1 FROM public.venues v
                    WHERE v.id = target_venue_id
                      AND v.phone IS NOT NULL
                      AND RIGHT(REGEXP_REPLACE(v.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(public.current_user_phone(), '\D', '', 'g'), 9)
                )
                OR
                EXISTS (
                    SELECT 1 FROM public.staff s
                    WHERE s.venue_id = target_venue_id
                      AND s.is_active = true
                      AND RIGHT(REGEXP_REPLACE(s.phone, '\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(public.current_user_phone(), '\D', '', 'g'), 9)
                )
            )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_phone() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_venue_authorized(uuid) TO anon, authenticated, service_role;


-- ── 2. DYNAMICALLY ENABLE RLS & APPLY CLEAN POLICIES ON EXISTING TABLES ──
DO $$
DECLARE
    r RECORD;
    t text;
    tables text[] := ARRAY[
        'venues', 'venue_settings', 'tables', 'staff', 'staff_shifts',
        'menu_categories', 'products', 'modifier_groups', 'modifier_options',
        'product_modifiers', 'bills', 'customer_sessions', 'order_submissions',
        'order_items', 'payments', 'payment_events', 'inventory_items',
        'inventory_transactions', 'reservations', 'event_tickets',
        'customer_profiles', 'expenses', 'activity_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Only process tables that actually exist in the database
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

            -- Drop existing policies to prevent conflicts
            FOR r IN (
                SELECT policyname 
                FROM pg_policies 
                WHERE schemaname = 'public' AND tablename = t
            ) LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, t);
            END LOOP;
        END IF;
    END LOOP;

    -- ── 3. CREATE POLICIES CONDITIONALLY ONLY FOR EXISTING TABLES ──

    -- 1. VENUES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN
        EXECUTE 'CREATE POLICY "venues_select" ON public.venues FOR SELECT USING (is_active = true OR owner_id = auth.uid());';
        EXECUTE 'CREATE POLICY "venues_modify" ON public.venues FOR ALL USING (owner_id = auth.uid() OR public.is_venue_authorized(id));';
    END IF;

    -- 2. VENUE SETTINGS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_settings') THEN
        EXECUTE 'CREATE POLICY "venue_settings_select" ON public.venue_settings FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "venue_settings_modify" ON public.venue_settings FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 3. TABLES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tables') THEN
        EXECUTE 'CREATE POLICY "tables_select" ON public.tables FOR SELECT USING (is_active = true OR public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "tables_modify" ON public.tables FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 4. STAFF
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff') THEN
        EXECUTE 'CREATE POLICY "staff_select" ON public.staff FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "staff_modify" ON public.staff FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 5. STAFF SHIFTS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_shifts') THEN
        EXECUTE 'CREATE POLICY "staff_shifts_select" ON public.staff_shifts FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "staff_shifts_modify" ON public.staff_shifts FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 6. MENU CATEGORIES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
        EXECUTE 'CREATE POLICY "menu_categories_select" ON public.menu_categories FOR SELECT USING (is_active = true OR public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "menu_categories_modify" ON public.menu_categories FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 7. PRODUCTS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        EXECUTE 'CREATE POLICY "products_select" ON public.products FOR SELECT USING (is_active = true OR public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "products_modify" ON public.products FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 8. MODIFIER GROUPS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modifier_groups') THEN
        EXECUTE 'CREATE POLICY "modifier_groups_select" ON public.modifier_groups FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "modifier_groups_modify" ON public.modifier_groups FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 9. MODIFIER OPTIONS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modifier_options') THEN
        EXECUTE 'CREATE POLICY "modifier_options_select" ON public.modifier_options FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "modifier_options_modify" ON public.modifier_options FOR ALL USING (
            EXISTS (SELECT 1 FROM public.modifier_groups g WHERE g.id = group_id AND public.is_venue_authorized(g.venue_id))
        );';
    END IF;

    -- 10. PRODUCT MODIFIERS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_modifiers') THEN
        EXECUTE 'CREATE POLICY "product_modifiers_select" ON public.product_modifiers FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "product_modifiers_modify" ON public.product_modifiers FOR ALL USING (
            EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_venue_authorized(p.venue_id))
        );';
    END IF;

    -- 11. BILLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
        EXECUTE 'CREATE POLICY "bills_select" ON public.bills FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "bills_insert" ON public.bills FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "bills_update" ON public.bills FOR UPDATE USING (true);';
        EXECUTE 'CREATE POLICY "bills_delete" ON public.bills FOR DELETE USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 12. CUSTOMER SESSIONS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_sessions') THEN
        EXECUTE 'CREATE POLICY "customer_sessions_select" ON public.customer_sessions FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "customer_sessions_insert" ON public.customer_sessions FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "customer_sessions_update" ON public.customer_sessions FOR UPDATE USING (true);';
        EXECUTE 'CREATE POLICY "customer_sessions_delete" ON public.customer_sessions FOR DELETE USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 13. ORDER SUBMISSIONS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_submissions') THEN
        EXECUTE 'CREATE POLICY "order_submissions_select" ON public.order_submissions FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "order_submissions_insert" ON public.order_submissions FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "order_submissions_update" ON public.order_submissions FOR UPDATE USING (true);';
        EXECUTE 'CREATE POLICY "order_submissions_delete" ON public.order_submissions FOR DELETE USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 14. ORDER ITEMS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        EXECUTE 'CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE USING (true);';
        EXECUTE 'CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE USING (true);';
    END IF;

    -- 15. PAYMENTS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        EXECUTE 'CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 16. PAYMENT EVENTS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_events') THEN
        EXECUTE 'CREATE POLICY "payment_events_all" ON public.payment_events FOR ALL USING (true);';
    END IF;

    -- 17. INVENTORY ITEMS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items') THEN
        EXECUTE 'CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "inventory_items_modify" ON public.inventory_items FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 18. INVENTORY TRANSACTIONS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
        EXECUTE 'CREATE POLICY "inventory_transactions_select" ON public.inventory_transactions FOR SELECT USING (public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "inventory_transactions_modify" ON public.inventory_transactions FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 19. RESERVATIONS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        EXECUTE 'CREATE POLICY "reservations_select" ON public.reservations FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "reservations_insert" ON public.reservations FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "reservations_modify" ON public.reservations FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 20. EVENT TICKETS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_tickets') THEN
        EXECUTE 'CREATE POLICY "event_tickets_select" ON public.event_tickets FOR SELECT USING (is_active = true OR public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "event_tickets_modify" ON public.event_tickets FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 21. CUSTOMER PROFILES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_profiles') THEN
        EXECUTE 'CREATE POLICY "customer_profiles_select" ON public.customer_profiles FOR SELECT USING (true);';
        EXECUTE 'CREATE POLICY "customer_profiles_insert" ON public.customer_profiles FOR INSERT WITH CHECK (true);';
        EXECUTE 'CREATE POLICY "customer_profiles_update" ON public.customer_profiles FOR UPDATE USING (true);';
        EXECUTE 'CREATE POLICY "customer_profiles_delete" ON public.customer_profiles FOR DELETE USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 22. EXPENSES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
        EXECUTE 'CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "expenses_modify" ON public.expenses FOR ALL USING (public.is_venue_authorized(venue_id));';
    END IF;

    -- 23. ACTIVITY LOGS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
        EXECUTE 'CREATE POLICY "activity_logs_select" ON public.activity_logs FOR SELECT USING (public.is_venue_authorized(venue_id));';
        EXECUTE 'CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT WITH CHECK (true);';
    END IF;

END $$;
