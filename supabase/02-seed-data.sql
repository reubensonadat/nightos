-- ==============================================================================
-- 02-seed-data.sql
-- Run this AFTER 01-schema-and-logic.sql
-- Populates Velvet Lounge with staff (including your phone number), menu items, 
-- tables, and mock sales data for yesterday and today to test the manager dashboard.
-- ==============================================================================

-- 1. Get or Create Velvet Lounge
DO $$
DECLARE
    v_owner_id uuid;
    v_venue_id uuid;
    v_waiter_id uuid;
    v_kitchen_id uuid;
    v_category_id uuid;
    v_product1_id uuid;
    v_product2_id uuid;
    v_table1_id uuid;
    v_table2_id uuid;
    v_bill1_id uuid;
    v_bill2_id uuid;
    v_sub1_id uuid;
    v_sub2_id uuid;
BEGIN
    -- Check if venue exists
    SELECT id INTO v_venue_id FROM public.venues WHERE slug = 'velvet-lounge' LIMIT 1;
    
    IF v_venue_id IS NULL THEN
        -- Find the user's auth account to make them the owner
        SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
        
        IF v_owner_id IS NULL THEN
            RAISE EXCEPTION 'No user found in auth.users. Please sign up in the app first so you can be the owner of the venue.';
        END IF;
        
        -- Create the venue
        INSERT INTO public.venues (owner_id, name, slug, currency, timezone, is_active)
        VALUES (v_owner_id, 'Velvet Lounge', 'velvet-lounge', 'GHS', 'Africa/Accra', true)
        RETURNING id INTO v_venue_id;
    END IF;

    -- 2. Seed Staff Members
    -- User's Waiter Account (Phone: 020 153 4711, PIN: 0000)
    SELECT id INTO v_waiter_id FROM public.staff WHERE phone = public.normalise_phone('0201534711') LIMIT 1;
    
    IF v_waiter_id IS NULL THEN
        INSERT INTO public.staff (venue_id, name, phone, role, is_active, max_tables)
        VALUES (
            v_venue_id, 
            'Demo Waiter', 
            public.normalise_phone('0201534711'), 
            'waiter', 
            true, 
            10, 
        )
        RETURNING id INTO v_waiter_id;
    ELSE
        UPDATE public.staff 
        SET is_active = true 
        WHERE id = v_waiter_id;
    END IF;

    -- A Kitchen Staff Account (Phone: 055 555 5555, PIN: 0000)
    SELECT id INTO v_kitchen_id FROM public.staff WHERE phone = public.normalise_phone('0555555555') LIMIT 1;
    
    IF v_kitchen_id IS NULL THEN
        INSERT INTO public.staff (venue_id, name, phone, role, is_active, max_tables)
        VALUES (
            v_venue_id, 
            'Demo Chef', 
            public.normalise_phone('0555555555'), 
            'kitchen', 
            true, 
            0, 
        )
        RETURNING id INTO v_kitchen_id;
    ELSE
        UPDATE public.staff 
        SET is_active = true 
        WHERE id = v_kitchen_id;
    END IF;

    -- 3. Seed Tables
    SELECT id INTO v_table1_id FROM public.tables WHERE venue_id = v_venue_id AND table_number = 1 LIMIT 1;
    IF v_table1_id IS NULL THEN
        INSERT INTO public.tables (venue_id, table_number, table_label, capacity, area, is_active, qr_code_token)
        VALUES (v_venue_id, 1, 'Table 1', 4, 'Main', true, 'token_t1')
        RETURNING id INTO v_table1_id;
    END IF;

    SELECT id INTO v_table2_id FROM public.tables WHERE venue_id = v_venue_id AND table_number = 2 LIMIT 1;
    IF v_table2_id IS NULL THEN
        INSERT INTO public.tables (venue_id, table_number, table_label, capacity, area, is_active, qr_code_token)
        VALUES (v_venue_id, 2, 'Table 2', 2, 'Outdoor', true, 'token_t2')
        RETURNING id INTO v_table2_id;
    END IF;

    -- 4. Seed Menu Categories & Products
    SELECT id INTO v_category_id FROM public.menu_categories WHERE venue_id = v_venue_id AND name = 'Signatures' LIMIT 1;
    IF v_category_id IS NULL THEN
        INSERT INTO public.menu_categories (venue_id, name, sort_order)
        VALUES (v_venue_id, 'Signatures', 1)
        RETURNING id INTO v_category_id;
    END IF;

    SELECT id INTO v_product1_id FROM public.products WHERE venue_id = v_venue_id AND name = 'Jollof Rice Special' LIMIT 1;
    IF v_product1_id IS NULL THEN
        INSERT INTO public.products (venue_id, category_id, name, price, station, is_active)
        VALUES (v_venue_id, v_category_id, 'Jollof Rice Special', 85.00, 'kitchen', true)
        RETURNING id INTO v_product1_id;
    END IF;

    SELECT id INTO v_product2_id FROM public.products WHERE venue_id = v_venue_id AND name = 'Signature Cocktail' LIMIT 1;
    IF v_product2_id IS NULL THEN
        INSERT INTO public.products (venue_id, category_id, name, price, station, is_active)
        VALUES (v_venue_id, v_category_id, 'Signature Cocktail', 45.00, 'bar', true)
        RETURNING id INTO v_product2_id;
    END IF;


    -- 5. Seed Historical Transactions (Yesterday)
    -- Bill 1: Completed Yesterday
    INSERT INTO public.bills (venue_id, table_id, status, waiter_id, total_amount, created_at, updated_at)
    VALUES (v_venue_id, v_table1_id, 'paid', v_waiter_id, 130.00, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
    RETURNING id INTO v_bill1_id;

    -- Add items to Bill 1
    INSERT INTO public.order_submissions (id, venue_id, bill_id, status, station, created_at)
    VALUES (gen_random_uuid(), v_venue_id, v_bill1_id, 'served', 'kitchen', NOW() - INTERVAL '1 day')
    RETURNING id INTO v_sub1_id;

    INSERT INTO public.order_items (submission_id, bill_id, product_id, product_name, quantity, unit_price, line_total, created_at)
    VALUES 
    (v_sub1_id, v_bill1_id, v_product1_id, 'Jollof Rice Special', 1, 85.00, 85.00, NOW() - INTERVAL '1 day'),
    (v_sub1_id, v_bill1_id, v_product2_id, 'Signature Cocktail', 1, 45.00, 45.00, NOW() - INTERVAL '1 day');

    -- Record Payment for Bill 1
    INSERT INTO public.payments (venue_id, bill_id, amount, method, status, staff_id, reference, created_at)
    VALUES (v_venue_id, v_bill1_id, 130.00, 'CASH', 'completed', v_waiter_id, 'REF-YESTERDAY-1', NOW() - INTERVAL '1 day');

    -- 6. Seed Current Transactions (Today)
    -- Bill 2: Open Today
    INSERT INTO public.bills (venue_id, table_id, status, waiter_id, total_amount, created_at, updated_at)
    VALUES (v_venue_id, v_table2_id, 'open', v_waiter_id, 85.00, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
    RETURNING id INTO v_bill2_id;

    -- Add items to Bill 2
    INSERT INTO public.order_submissions (id, venue_id, bill_id, status, station, created_at)
    VALUES (gen_random_uuid(), v_venue_id, v_bill2_id, 'ready', 'kitchen', NOW() - INTERVAL '1 hour')
    RETURNING id INTO v_sub2_id;

    INSERT INTO public.order_items (submission_id, bill_id, product_id, product_name, quantity, unit_price, line_total, created_at)
    VALUES (v_sub2_id, v_bill2_id, v_product1_id, 'Jollof Rice Special', 1, 85.00, 85.00, NOW() - INTERVAL '1 hour');

    -- Note: No payment for Bill 2 yet, it's open.
    
END $$;
