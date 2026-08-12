DO $$
DECLARE
    v_venue_id uuid;
    v_table_id uuid;
    v_waiter_id uuid;
    v_bill_id uuid;
    v_submission_1 uuid;
    v_submission_2 uuid;
    v_product_1 record;
    v_product_2 record;
    v_product_3 record;
BEGIN
    -- 1. Get Venue
    SELECT id INTO v_venue_id FROM public.venues WHERE slug = 'velvet-lounge' LIMIT 1;
    
    -- 2. Get a Table
    SELECT id INTO v_table_id FROM public.tables WHERE venue_id = v_venue_id LIMIT 1;
    
    -- 3. Get a Waiter
    SELECT id INTO v_waiter_id FROM public.staff WHERE venue_id = v_venue_id AND role = 'waiter' LIMIT 1;
    
    -- 4. Create a Bill
    INSERT INTO public.bills (venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, service_charge, vat, total, amount_paid, is_merged)
    VALUES (v_venue_id, v_table_id, v_waiter_id, 2, 'open', 'POSTPAY', 0, 0, 0, 0, 0, false)
    RETURNING id INTO v_bill_id;
    
    -- 5. Create Order Submissions
    INSERT INTO public.order_submissions (bill_id, venue_id, guest_name, status, station, priority, notes)
    VALUES (v_bill_id, v_venue_id, 'Mock Order', 'pending', 'kitchen', true, 'VIP guest')
    RETURNING id INTO v_submission_1;
    
    INSERT INTO public.order_submissions (bill_id, venue_id, guest_name, status, station, priority, notes)
    VALUES (v_bill_id, v_venue_id, 'Mock Order', 'preparing', 'kitchen', false, NULL)
    RETURNING id INTO v_submission_2;
    
    -- 6. Get some kitchen products
    SELECT id, name, price INTO v_product_1 FROM public.products WHERE venue_id = v_venue_id AND station = 'kitchen' LIMIT 1 OFFSET 0;
    SELECT id, name, price INTO v_product_2 FROM public.products WHERE venue_id = v_venue_id AND station = 'kitchen' LIMIT 1 OFFSET 1;
    SELECT id, name, price INTO v_product_3 FROM public.products WHERE venue_id = v_venue_id AND station = 'kitchen' LIMIT 1 OFFSET 2;
    
    -- 7. Insert Order Items
    INSERT INTO public.order_items (submission_id, bill_id, product_id, product_name, quantity, unit_price, line_total, notes, guest_name)
    VALUES (v_submission_1, v_bill_id, v_product_1.id, v_product_1.name, 2, v_product_1.price, v_product_1.price * 2, 'Extra crispy', 'Mock Order');
    
    INSERT INTO public.order_items (submission_id, bill_id, product_id, product_name, quantity, unit_price, line_total, notes, guest_name)
    VALUES (v_submission_1, v_bill_id, v_product_2.id, v_product_2.name, 1, v_product_2.price, v_product_2.price, NULL, 'Mock Order');
    
    INSERT INTO public.order_items (submission_id, bill_id, product_id, product_name, quantity, unit_price, line_total, notes, guest_name)
    VALUES (v_submission_2, v_bill_id, v_product_3.id, v_product_3.name, 1, v_product_3.price, v_product_3.price, 'No onions', 'Mock Order');

END $$;
