-- ═══════════════════════════════════════════════════════════════════
-- BYSEN / NIGHTOS — CLEAN SEED DATA (THE VELVET ROOM)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_venue_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_cat_starters uuid := gen_random_uuid();
    v_cat_mains uuid := gen_random_uuid();
    v_cat_cocktails uuid := gen_random_uuid();
    v_cat_wines uuid := gen_random_uuid();
    
    v_prod_steak uuid := gen_random_uuid();
    v_prod_martini uuid := gen_random_uuid();
    v_prod_jollof uuid := gen_random_uuid();
    v_prod_wings uuid := gen_random_uuid();

    v_mod_doneness uuid := gen_random_uuid();
    v_mod_sides uuid := gen_random_uuid();

    v_staff_owner uuid := gen_random_uuid();
    v_staff_manager uuid := gen_random_uuid();
    v_staff_waiter1 uuid := gen_random_uuid();
    v_staff_kitchen uuid := gen_random_uuid();
    v_staff_bar uuid := gen_random_uuid();

    v_tbl_1 uuid := gen_random_uuid();
    v_tbl_2 uuid := gen_random_uuid();
    v_tbl_3 uuid := gen_random_uuid();
    v_tbl_4 uuid := gen_random_uuid();
    v_tbl_5 uuid := gen_random_uuid();
BEGIN
    -- ── 1. VENUE ──
    INSERT INTO public.venues (
        id, name, slug, description, address, phone, email,
        payment_model, service_charge_pct, vat_pct, currency, timezone, is_active
    ) VALUES (
        v_venue_id,
        'Velvet Lounge',
        'velvet-lounge',
        'Sophisticated dining, craft cocktails, and late-night lounge.',
        '14 Senchi Street, Airport Residential Area, Accra',
        '+233501234567',
        'velvet@bysen.app',
        'POSTPAY',
        10.00,
        12.50,
        'GHS',
        'Africa/Accra',
        true
    ) ON CONFLICT (id) DO NOTHING;

    -- ── 2. STAFF ──
    INSERT INTO public.staff (id, venue_id, name, phone, email, role, is_active, max_tables, area_assignment, hourly_rate)
    VALUES
        (v_staff_owner, v_venue_id, 'Kofi Mensah (Owner)', '+233501234567', 'kofi@thevelvetroom.com', 'owner', true, 10, 'All', 50.00),
        (v_staff_manager, v_venue_id, 'Ama Serwaa (Manager)', '+233507654321', 'ama@thevelvetroom.com', 'manager', true, 10, 'All', 35.00),
        (v_staff_waiter1, v_venue_id, 'Kwame Boateng (Waiter)', '+233241112233', 'kwame@thevelvetroom.com', 'waiter', true, 6, 'Main Hall', 20.00),
        (v_staff_kitchen, v_venue_id, 'Chef Akwasi (Kitchen)', '+233242223344', 'chef@thevelvetroom.com', 'kitchen', true, 0, 'Kitchen', 30.00),
        (v_staff_bar, v_venue_id, 'Barista Esi (Bar)', '+233243334455', 'esi@thevelvetroom.com', 'bar', true, 0, 'Bar', 25.00)
    ON CONFLICT (id) DO NOTHING;

    -- Active Shift for waiter & kitchen
    INSERT INTO public.staff_shifts (venue_id, staff_id, status, supervisor_approved)
    VALUES
        (v_venue_id, v_staff_waiter1, 'active', true),
        (v_venue_id, v_staff_kitchen, 'active', true),
        (v_venue_id, v_staff_bar, 'active', true);

    -- ── 3. TABLES ──
    INSERT INTO public.tables (id, venue_id, table_number, table_label, capacity, area, qr_code_token, is_active)
    VALUES
        (v_tbl_1, v_venue_id, 1, 'Table 1', 4, 'Main Hall', 'table-1-tok', true),
        (v_tbl_2, v_venue_id, 2, 'Table 2', 2, 'Main Hall', 'table-2-tok', true),
        (v_tbl_3, v_venue_id, 3, 'Table 3', 6, 'Main Hall', 'table-3-tok', true),
        (v_tbl_4, v_venue_id, 4, 'Booth A', 4, 'VIP Lounge', 'table-4-tok', true),
        (v_tbl_5, v_venue_id, 5, 'Booth B', 6, 'VIP Lounge', 'table-5-tok', true)
    ON CONFLICT (id) DO NOTHING;

    -- ── 4. MENU CATEGORIES ──
    INSERT INTO public.menu_categories (id, venue_id, name, sort_order, is_active)
    VALUES
        (v_cat_starters, v_venue_id, 'Starters & Small Plates', 1, true),
        (v_cat_mains, v_venue_id, 'Signature Mains', 2, true),
        (v_cat_cocktails, v_venue_id, 'Craft Cocktails', 3, true),
        (v_cat_wines, v_venue_id, 'Fine Wines & Spirits', 4, true)
    ON CONFLICT (id) DO NOTHING;

    -- ── 5. PRODUCTS ──
    INSERT INTO public.products (
        id, venue_id, category_id, name, description, price, cost_price,
        images, station, tags, sort_order, is_active
    ) VALUES
        (
            v_prod_steak, v_venue_id, v_cat_mains,
            'Prime Ribeye Steak (300g)',
            'Char-grilled USDA Prime Ribeye with rosemary garlic butter and roasted bone marrow jus.',
            280.00, 110.00,
            ARRAY['https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'],
            'kitchen', ARRAY['Signature', 'Chef Special', 'Gluten Free'], 1, true
        ),
        (
            v_prod_jollof, v_venue_id, v_cat_mains,
            'Smoked Velvet Jollof with Lamb Shank',
            'Firewood-infused jasmine jollof rice served with slow-braised tender lamb shank and plantain.',
            195.00, 75.00,
            ARRAY['https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80'],
            'kitchen', ARRAY['Local Fusion', 'Popular'], 2, true
        ),
        (
            v_prod_wings, v_venue_id, v_cat_starters,
            'Crispy Suya Glazed Wings',
            'Crispy chicken wings tossed in a spicy yaji peanut honey glaze with cooling cucumber ranch.',
            95.00, 35.00,
            ARRAY['https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80'],
            'kitchen', ARRAY['Spicy', 'Sharing'], 3, true
        ),
        (
            v_prod_martini, v_venue_id, v_cat_cocktails,
            'Smoked Hibiscus Espresso Martini',
            'Vodka, fresh espresso, homemade hibiscus cordial, Kahlúa, and dark chocolate smoke dust.',
            85.00, 22.00,
            ARRAY['https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80'],
            'bar', ARRAY['Cocktail', 'Signature'], 4, true
        )
    ON CONFLICT (id) DO NOTHING;

    -- ── 6. MODIFIERS ──
    INSERT INTO public.modifier_groups (id, venue_id, name, required, multi_select, max_select, sort_order)
    VALUES
        (v_mod_doneness, v_venue_id, 'Steak Doneness', true, false, 1, 1),
        (v_mod_sides, v_venue_id, 'Choice of Side', false, true, 2, 2)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.modifier_options (group_id, name, price_delta, sort_order)
    VALUES
        (v_mod_doneness, 'Medium Rare', 0.00, 1),
        (v_mod_doneness, 'Medium', 0.00, 2),
        (v_mod_doneness, 'Medium Well', 0.00, 3),
        (v_mod_sides, 'Truffle Parmesan Fries', 25.00, 1),
        (v_mod_sides, 'Charred Asparagus', 20.00, 2),
        (v_mod_sides, 'Creamy Mashed Potatoes', 15.00, 3);

    INSERT INTO public.product_modifiers (product_id, group_id)
    VALUES
        (v_prod_steak, v_mod_doneness),
        (v_prod_steak, v_mod_sides)
    ON CONFLICT DO NOTHING;

    -- ── 7. INVENTORY ITEMS ──
    INSERT INTO public.inventory_items (venue_id, product_id, name, category, stock_qty, unit, reorder_threshold, unit_cost, supplier, is_active)
    VALUES
        (v_venue_id, v_prod_steak, 'USDA Prime Ribeye (Cases)', 'Meat & Poultry', 24, 'kg', 5, 85.00, 'Prime Meats GH', true),
        (v_venue_id, v_prod_wings, 'Jumbo Chicken Wings', 'Meat & Poultry', 50, 'kg', 10, 22.00, 'Accra Fresh Poultry', true),
        (v_venue_id, v_prod_martini, 'Smirnoff Premium Vodka (750ml)', 'Liquor & Spirits', 36, 'bottles', 6, 45.00, 'Vintage Wines & Spirits', true),
        (v_venue_id, null, 'Truffle Oil (500ml)', 'Dry Goods', 8, 'bottles', 2, 60.00, 'Gourmet Imports', true),
        (v_venue_id, null, 'Jasmine Rice (50kg Bag)', 'Dry Goods', 15, 'bags', 3, 120.00, 'Royal Grain Ltd', true);

    -- ── 8. CUSTOMER PROFILES ──
    INSERT INTO public.customer_profiles (venue_id, name, phone, email, total_visits, total_spend, loyalty_tier, is_vip)
    VALUES
        (v_venue_id, 'Nana Osei', '+233240001122', 'nana.osei@gmail.com', 12, 3420.00, 'vip', true),
        (v_venue_id, 'Sarah Mensah', '+233501112233', 'sarah.m@yahoo.com', 5, 1150.00, 'regular', false),
        (v_venue_id, 'Kwesi Arthur', '+233271112233', 'kwesi.a@gmail.com', 18, 5600.00, 'vip', true);

    -- ── 9. DEFAULT OTP FOR QUICK TESTING ──
    INSERT INTO public.otp_codes (phone, code, expires_at, is_used)
    VALUES
        ('+233501234567', '123456', now() + interval '30 days', false),
        ('+233507654321', '123456', now() + interval '30 days', false),
        ('+233241112233', '123456', now() + interval '30 days', false);

END $$;
