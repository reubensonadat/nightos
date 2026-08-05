-- ═══════════════════════════════════════════════════════════════
-- NightOS — Velvet Lounge seed
-- ═══════════════════════════════════════════════════════════════
-- HOW TO RUN:
--   1. FIRST sign up in the app (phone OTP) with 0541651298 so your
--      auth user exists in auth.users.
--   2. Paste this whole file into Supabase Dashboard → SQL Editor → Run.
--   3. If nothing was inserted, the owner lookup failed — confirm you
--      signed up with 0541651298, then re-run.
-- Safe to re-run (everything is idempotent via ON CONFLICT).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. VENUE ───────────────────────────────────────────────────
INSERT INTO public.venues
  (owner_id, name, slug, description, phone, email, address,
   payment_model, service_charge_pct, vat_pct, tax_inclusive,
   currency, timezone, is_active)
SELECT id, 'Velvet Lounge', 'velvet-lounge',
       'Premium nightclub experience — cocktails, wine and small plates.',
       '0541651298', 'hello@velvetlounge.gh', 'Accra, Ghana',
       'POSTPAY', 10.00, 12.50, false,
       'GHS', 'Africa/Accra', true
FROM auth.users
WHERE (raw_user_meta_data->>'phone' LIKE '%541651298')
   OR (phone LIKE '%541651298')
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- ── 2. MENU CATEGORIES ─────────────────────────────────────────
INSERT INTO public.menu_categories (venue_id, name, sort_order, is_active)
SELECT v.id, c.name, c.sort, true
FROM public.venues v
CROSS JOIN (VALUES
    ('Signatures', 1),
    ('Spirits', 2),
    ('Wines', 3),
    ('Small Plates', 4)
) AS c(name, sort)
WHERE v.slug = 'velvet-lounge'
ON CONFLICT (venue_id, name) DO NOTHING;

-- ── 3. PRODUCTS ────────────────────────────────────────────────
-- station: 'bar' = drinks, 'kitchen' = plates
INSERT INTO public.products
  (venue_id, category_id, name, description, long_description, price,
   images, station, tags, abv, origin, is_active, sort_order)
SELECT
  v.id,
  mc.id AS category_id,
  p.name, p.description, p.long_description, p.price,
  jsonb_build_array(p.image) AS images,
  p.station, p.tags::jsonb, p.abv, p.origin, true, p.sort
FROM public.venues v
JOIN public.menu_categories mc ON mc.venue_id = v.id
CROSS JOIN (VALUES
  ('Velvet Negroni', 'Signatures', 110, 'bar', 'Botanical gin, Campari, sweet vermouth and a single smoked ice cube.', 'Our house signature. Botanical gin balanced with bitter Campari and sweet vermouth, finished with a single smoked ice cube that releases aroma as it melts.', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80', '["Chef''s Pick"]', '24%', NULL, 1),
  ('Smoked Old Fashioned', 'Signatures', 130, 'bar', 'Aged bourbon, demerara, orange bitters, finished under applewood smoke.', 'Aged Kentucky bourbon, demerara syrup and orange bitters, stirred over one hand-cut ice cube and finished under a glass dome of applewood smoke at the table.', 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80', '["Popular"]', '32%', NULL, 2),
  ('Velvet Martini', 'Signatures', 105, 'bar', 'London Dry gin, dry vermouth, olive brine, served with three Castelvetrano olives.', 'London Dry gin, a whisper of dry vermouth and a dash of olive brine, stirred over cracked ice and served up in a chilled coupe.', 'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=900&q=80', '[]', '28%', NULL, 3),
  ('Hibiscus Spritz', 'Signatures', 95, 'bar', 'Prosecco, hibiscus cordial, fresh lime, topped with soda and edible petals.', 'A floral, refreshing spritz — Prosecco, house hibiscus cordial and fresh lime, topped with soda and finished with edible petals.', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80', '["New"]', '11%', NULL, 4),
  ('Don Julio 1942', 'Spirits', 280, 'bar', 'Ultra-premium añejo tequila — notes of vanilla, caramel and toasted oak.', 'Ultra-premium añejo tequila aged in American oak barrels. Notes of vanilla, caramel and toasted oak.', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80', '["Popular"]', '40%', 'Mexico', 5),
  ('Macallan 12', 'Spirits', 220, 'bar', 'Double cask matured single malt — honey, citrus and oak.', 'Double cask matured single malt whisky with notes of honey, citrus and rich oak.', 'https://images.unsplash.com/photo-1514218953589-2d7d37efd2dc?auto=format&fit=crop&w=900&q=80', '[]', '43%', 'Scotland', 6),
  ('Hendrick''s Gin', 'Spirits', 90, 'bar', 'Cucumber and rose botanical gin, served over ice with tonic.', 'An unusual gin infused with cucumber and rose petals. Serve over ice with premium tonic.', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80', '[]', '44%', 'Scotland', 7),
  ('Chianti Riserva', 'Wines', 180, 'bar', 'Sangiovese-led Tuscan red — dark cherry, leather and spice.', 'Full-bodied Sangiovese-led blend from Tuscany. Dark cherry, leather and warm spice.', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80', '[]', NULL, 'Italy', 8),
  ('Sancerre Blanc', 'Wines', 160, 'bar', 'Crisp Loire Sauvignon Blanc — citrus, gooseberry and flint.', 'Crisp, mineral-driven Sauvignon Blanc from the Loire. Citrus, gooseberry and flint.', 'https://images.unsplash.com/photo-1470158499416-75be9f0c4a39?auto=format&fit=crop&w=900&q=80', '[]', NULL, 'France', 9),
  ('Champagne Brut', 'Wines', 145, 'bar', 'Classic brut Champagne — green apple, brioche and citrus.', 'Classic brut Champagne with green apple, brioche and citrus notes. Perfect for celebrations.', 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=900&q=80', '["Popular"]', '12%', 'France', 10),
  ('Charcuterie Board', 'Small Plates', 220, 'kitchen', 'Cured meats, artisan cheeses, olives and house sourdough.', 'A generous board of cured meats, artisan cheeses, marinated olives, seasonal fruit and warm house sourdough.', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80', '["Chef''s Pick"]', NULL, NULL, 11),
  ('Truffle Arancini', 'Small Plates', 180, 'kitchen', 'Crispy risotto balls, truffle pecorino, wild mushrooms.', 'Golden-crisp risotto balls with truffle pecorino and wild mushrooms, served with saffron aioli.', 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=80', '[]', NULL, NULL, 12),
  ('Grilled Octopus', 'Small Plates', 150, 'kitchen', 'Charred octopus, smoked paprika, lemon confit, herbs.', 'Tender charred octopus with smoked paprika, lemon confit and fresh garden herbs.', 'https://images.unsplash.com/photo-1551500226-b50b0dfaa85d?auto=format&fit=crop&w=900&q=80', '["New"]', NULL, NULL, 13),
  ('Velvet Sliders', 'Small Plates', 85, 'kitchen', 'Three mini burgers — wagyu beef, smoked cheddar, truffle mayo.', 'Three mini wagyu beef sliders with smoked cheddar, caramelised onion and truffle mayo.', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80', '["Popular"]', NULL, NULL, 14)
) AS p(name, category, price, station, description, long_description, image, tags, abv, origin, sort)
WHERE v.slug = 'velvet-lounge'
  AND mc.name = p.category
ON CONFLICT DO NOTHING;

-- ── 4. MODIFIER GROUPS + OPTIONS ───────────────────────────────
INSERT INTO public.modifier_groups (venue_id, name, required, multi_select, max_select, sort_order)
SELECT v.id, g.name, g.required, g.multi, g.max, g.sort
FROM public.venues v
CROSS JOIN (VALUES
    ('Ice', false, false, NULL, 1),
    ('Strength', false, false, NULL, 2),
    ('Garnish', false, true, 3, 3),
    ('Serve', false, false, NULL, 4),
    ('Pour', false, false, NULL, 5),
    ('Side', false, false, NULL, 6)
) AS g(name, required, multi, max, sort)
WHERE v.slug = 'velvet-lounge'
ON CONFLICT DO NOTHING;

-- Options
INSERT INTO public.modifier_options (group_id, name, price_delta, sort_order)
SELECT mg.id, o.name, o.delta, o.sort
FROM public.modifier_groups mg
JOIN public.venues v ON v.id = mg.venue_id
CROSS JOIN (VALUES
    ('Ice', 'Regular', 0, 1), ('Ice', 'Light', 0, 2), ('Ice', 'Extra', 0, 3), ('Ice', 'None (Neat)', 0, 4),
    ('Strength', 'Light', 0, 1), ('Strength', 'Regular', 0, 2), ('Strength', 'Strong (+GHS 20)', 20, 3),
    ('Garnish', 'Olives', 0, 1), ('Garnish', 'Citrus Twist', 0, 2), ('Garnish', 'Brandied Cherry (+GHS 10)', 10, 3), ('Garnish', 'Fresh Herbs', 0, 4),
    ('Serve', 'Neat', 0, 1), ('Serve', 'On the Rocks', 0, 2), ('Serve', 'Up (Coupe)', 0, 3),
    ('Pour', 'Glass (150ml)', 0, 1), ('Pour', 'Bottle (750ml, +GHS 280)', 280, 2),
    ('Side', 'Warm Sourdough', 0, 1), ('Side', 'Garden Greens', 0, 2), ('Side', 'House Pickles', 0, 3), ('Side', 'No Side', 0, 4)
) AS o(group_name, name, delta, sort)
WHERE v.slug = 'velvet-lounge'
  AND mg.name = o.group_name
ON CONFLICT DO NOTHING;

-- ── 5. TABLES 1-8 with QR tokens ───────────────────────────────
INSERT INTO public.tables
  (venue_id, table_number, table_label, capacity, area, qr_code_token, is_active)
SELECT v.id, t.num, t.num::text, t.cap, t.area, t.token, true
FROM public.venues v
CROSS JOIN (VALUES
    (1, 2, 'VIP',    'VL-TABLE-01'),
    (2, 2, 'VIP',    'VL-TABLE-02'),
    (3, 4, 'Main',   'VL-TABLE-03'),
    (4, 4, 'Main',   'VL-TABLE-04'),
    (5, 4, 'Main',   'VL-TABLE-05'),
    (6, 6, 'Lounge', 'VL-TABLE-06'),
    (7, 6, 'Lounge', 'VL-TABLE-07'),
    (8, 8, 'Bar',    'VL-TABLE-08')
) AS t(num, cap, area, token)
WHERE v.slug = 'velvet-lounge'
ON CONFLICT (venue_id, table_number) DO UPDATE SET qr_code_token = EXCLUDED.qr_code_token;

-- ── 6. STAFF (phone + PIN login) ─────────────────────────────────
-- Owner = your signup phone. PINs are plaintext for now (hashed in v2).
INSERT INTO public.staff
  (venue_id, name, phone, role, is_active, max_tables, area_assignment)
SELECT v.id, s.name, public.normalise_phone(s.phone), s.role, true, s.max_tables, s.area
FROM public.venues v
CROSS JOIN (VALUES
    ('Velvet Owner', '0541651298', 'owner', '1234', 6, NULL),
    ('Kojo',         '0240000001', 'waiter', '1234', 6, 'Main'),
    ('Ama',          '0240000002', 'bar',    '1234', 6, NULL),
    ('Esi',          '0240000003', 'kitchen','1234', 6, NULL),
    ('Kofi',         '0240000004', 'cashier','1234', 6, NULL),
    ('Demo Waiter',  '0201534711', 'waiter', '0000', 6, 'Main')
) AS s(name, phone, role, pin, max_tables, area)
WHERE v.slug = 'velvet-lounge'
ON CONFLICT (venue_id, phone) DO NOTHING;

-- ── 7. INVENTORY (linked to products) ──────────────────────────
INSERT INTO public.inventory_items
  (venue_id, product_id, name, category, stock_qty, unit, reorder_threshold, unit_cost)
SELECT v.id, p.id, p.name, CASE WHEN p.station = 'bar' THEN 'beverage' ELSE 'food' END,
       10, 'units', 3, p.price * 0.45
FROM public.venues v
JOIN public.products p ON p.venue_id = v.id
WHERE v.slug = 'velvet-lounge'
ON CONFLICT DO NOTHING;

-- ── 8. RLS FOR CUSTOMER (QR) FLOW ──────────────────────────────
-- The QR flow is anonymous: a customer scans → gets a session token →
-- opens a bill → submits orders → pays. RLS would block all of that by
-- default, so we add token-scoped policies. The client sends the token
-- in the `x-session-token` request header.

CREATE OR REPLACE FUNCTION public.request_session_token()
RETURNS text AS $$
    SELECT nullif(current_setting('request.headers', true)::json->>'x-session-token', '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.session_token_matches_bill(p_bill_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_sessions cs
        WHERE cs.bill_id = p_bill_id
          AND cs.session_token = public.request_session_token()
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.session_token_matches_self(p_session_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_sessions cs
        WHERE cs.id = p_session_id
          AND cs.session_token = public.request_session_token()
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- NOTE: both helpers are SECURITY DEFINER (owner = postgres, bypasses RLS) so
-- their internal SELECT on customer_sessions does not re-trigger policies.
-- The outer policy still enforces the token match, so nothing is bypassed.

-- tables: anyone can read active tables (needed for QR lookup by token)
DROP POLICY IF EXISTS "Customers can read tables" ON public.tables;
CREATE POLICY "Customers can read tables" ON public.tables
    FOR SELECT USING (is_active = true);

-- customer_sessions
DROP POLICY IF EXISTS "Customers can create sessions" ON public.customer_sessions;
CREATE POLICY "Customers can create sessions" ON public.customer_sessions
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Customers can read sessions" ON public.customer_sessions;
CREATE POLICY "Customers can read sessions" ON public.customer_sessions
    FOR SELECT USING (status = 'active' OR public.session_token_matches_self(id));
DROP POLICY IF EXISTS "Customers can update own session" ON public.customer_sessions;
CREATE POLICY "Customers can update own session" ON public.customer_sessions
    FOR UPDATE USING (public.session_token_matches_self(id));

-- bills
DROP POLICY IF EXISTS "Customers can open bills" ON public.bills;
CREATE POLICY "Customers can open bills" ON public.bills
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Customers can read open bills" ON public.bills;
CREATE POLICY "Customers can read open bills" ON public.bills
    FOR SELECT USING (status IN ('open', 'settling') OR public.session_token_matches_bill(id));
DROP POLICY IF EXISTS "Customers can update own bill" ON public.bills;
CREATE POLICY "Customers can update own bill" ON public.bills
    FOR UPDATE USING (public.session_token_matches_bill(id));

-- order_submissions / order_items: only via the bill's session token
DROP POLICY IF EXISTS "Customers can submit orders" ON public.order_submissions;
CREATE POLICY "Customers can submit orders" ON public.order_submissions
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));
DROP POLICY IF EXISTS "Customers can add items" ON public.order_items;
CREATE POLICY "Customers can add items" ON public.order_items
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));

-- payments: customer records cash/bank payments on their own bill
DROP POLICY IF EXISTS "Customers can record payments" ON public.payments;
CREATE POLICY "Customers can record payments" ON public.payments
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));

-- ── 8b. ANON MENU READS (QR → menu → cart flow) ────────────────
-- The QR flow is anonymous, so the customer-facing menu tables must be
-- readable by the anon role. Products/categories are filtered by is_active.
DROP POLICY IF EXISTS "Customers can read active venues" ON public.venues;
CREATE POLICY "Customers can read active venues" ON public.venues
    FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Customers can read menu categories" ON public.menu_categories;
CREATE POLICY "Customers can read menu categories" ON public.menu_categories
    FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Customers can read products" ON public.products;
CREATE POLICY "Customers can read products" ON public.products
    FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Customers can read modifier groups" ON public.modifier_groups;
CREATE POLICY "Customers can read modifier groups" ON public.modifier_groups
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Customers can read modifier options" ON public.modifier_options;
CREATE POLICY "Customers can read modifier options" ON public.modifier_options
    FOR SELECT USING (true);

-- ── 8c. OWNER READS (manager portal) ───────────────────────────
-- The signed-in venue owner can read everything for their venue.
-- (auth.uid() = owner's auth user id, matched via venues.owner_id)
CREATE OR REPLACE FUNCTION public.owner_venue_id()
RETURNS uuid AS $$
    SELECT id FROM public.venues WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Owner reads own venue" ON public.venues;
CREATE POLICY "Owner reads own venue" ON public.venues
    FOR SELECT USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owner reads tables" ON public.tables;
CREATE POLICY "Owner reads tables" ON public.tables
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads categories" ON public.menu_categories;
CREATE POLICY "Owner reads categories" ON public.menu_categories
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads products" ON public.products;
CREATE POLICY "Owner reads products" ON public.products
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads modifier groups" ON public.modifier_groups;
CREATE POLICY "Owner reads modifier groups" ON public.modifier_groups
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads bills" ON public.bills;
CREATE POLICY "Owner reads bills" ON public.bills
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads order submissions" ON public.order_submissions;
CREATE POLICY "Owner reads order submissions" ON public.order_submissions
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads order items" ON public.order_items;
CREATE POLICY "Owner reads order items" ON public.order_items
    FOR SELECT USING (bill_id IN (SELECT id FROM public.bills WHERE venue_id = public.owner_venue_id()));
DROP POLICY IF EXISTS "Owner reads payments" ON public.payments;
CREATE POLICY "Owner reads payments" ON public.payments
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads staff" ON public.staff;
CREATE POLICY "Owner reads staff" ON public.staff
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads staff shifts" ON public.staff_shifts;
CREATE POLICY "Owner reads staff shifts" ON public.staff_shifts
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads inventory" ON public.inventory_items;
CREATE POLICY "Owner reads inventory" ON public.inventory_items
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads customers" ON public.customer_profiles;
CREATE POLICY "Owner reads customers" ON public.customer_profiles
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads reservations" ON public.reservations;
CREATE POLICY "Owner reads reservations" ON public.reservations
    FOR SELECT USING (venue_id = public.owner_venue_id());
DROP POLICY IF EXISTS "Owner reads expenses" ON public.expenses;
CREATE POLICY "Owner reads expenses" ON public.expenses
    FOR SELECT USING (venue_id = public.owner_venue_id());

-- ── 8d. WAITER ASSIGNMENT (people-weighted load balancing) ─────
-- Called by the app when a customer confirms their party size at a QR
-- table. Load score = guests on open bills + 0.5 per open table, so a
-- waiter with 6 tables of 1-2 people is preferred over one already
-- carrying 3 tables of 5 people. Limits: max_tables, active shift, area.
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid AS $$
DECLARE
    v_venue_id uuid;
    v_table_id uuid;
    v_table_area text;
    v_best_waiter_id uuid;
BEGIN
    SELECT venue_id, table_id INTO v_venue_id, v_table_id
    FROM public.bills WHERE id = p_bill_id;

    SELECT area INTO v_table_area FROM public.tables WHERE id = v_table_id;

    SELECT s.id INTO v_best_waiter_id
    FROM public.staff s
    LEFT JOIN public.bills b
        ON b.waiter_id = s.id
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
            WHERE waiter_id = s.id
              AND status IN ('open', 'settling')
              AND id != p_bill_id
        ) < s.max_tables
    GROUP BY s.id, s.max_tables
    ORDER BY COALESCE(SUM(b.guest_count), 0) + 0.5 * COUNT(b.id) ASC
    LIMIT 1;

    IF v_best_waiter_id IS NOT NULL THEN
        UPDATE public.bills SET waiter_id = v_best_waiter_id WHERE id = p_bill_id;
    END IF;

    RETURN v_best_waiter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. QR URLS (update once deployed) ──────────────────────────
-- UPDATE public.tables
-- SET qr_code_url = 'https://<YOUR-APP-URL>/?table=' || qr_code_token
-- WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'velvet-lounge');

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify with:
--   SELECT name, slug FROM venues WHERE slug = 'velvet-lounge';
--   SELECT count(*) FROM products WHERE venue_id = (SELECT id FROM venues WHERE slug='velvet-lounge');
--   SELECT table_number, qr_code_token FROM tables ORDER BY table_number;
--   SELECT count(*) FROM modifier_options mo
--     JOIN modifier_groups mg ON mg.id = mo.group_id
--     WHERE mg.venue_id = (SELECT id FROM venues WHERE slug='velvet-lounge');
--   SELECT name, phone, role FROM staff ORDER BY role;
-- ═══════════════════════════════════════════════════════════════
