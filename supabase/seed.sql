-- NightOS Test Seed Data
-- Run in Supabase SQL Editor to populate test resources

-- 1. Create a dummy owner user in auth.users if not exists
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES (
    'd3b07384-d113-4c9b-a0c4-0d5b4d754160',
    'manager@velvetlounge.gh',
    '{"name": "Manager"}'::jsonb,
    'authenticated',
    'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the Velvet Lounge Venue
INSERT INTO public.venues (
    id,
    owner_id,
    name,
    slug,
    description,
    address,
    phone,
    email,
    payment_model,
    service_charge_pct,
    vat_pct,
    currency,
    timezone,
    is_active
) VALUES (
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'd3b07384-d113-4c9b-a0c4-0d5b4d754160',
    'Velvet Lounge',
    'velvet-lounge',
    'Premium nightclub and cocktail bar experience in Accra',
    '12 Cantonments Road, Accra, Ghana',
    '+233 24 000 0000',
    'hello@velvetlounge.gh',
    'POSTPAY',
    10.00,
    12.50,
    'GHS',
    'Africa/Accra',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create active tables with known verification tokens
INSERT INTO public.tables (
    id,
    venue_id,
    table_number,
    table_label,
    capacity,
    area,
    qr_code_token,
    is_active
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    1,
    'Table 01',
    2,
    'Main',
    'table1token',
    true
),
(
    '22222222-2222-2222-2222-222222222222',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    2,
    'Table 02',
    4,
    'Main',
    'table2token',
    true
),
(
    '33333333-3333-3333-3333-333333333333',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    3,
    'Table 03',
    6,
    'VIP',
    'table3token',
    true
),
(
    '44444444-4444-4444-4444-444444444444',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    4,
    'Table 04',
    2,
    'Bar',
    'table4token',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create Menu Categories
INSERT INTO public.menu_categories (
    id,
    venue_id,
    name,
    sort_order,
    is_active
) VALUES 
(
    'a1111111-1111-1111-1111-111111111111',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'Signatures',
    1,
    true
),
(
    'a2222222-2222-2222-2222-222222222222',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'Cocktails',
    2,
    true
),
(
    'a3333333-3333-3333-3333-333333333333',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'Bites',
    3,
    true
)
ON CONFLICT (id) DO NOTHING;

-- 5. Create products (menu items)
INSERT INTO public.products (
    id,
    venue_id,
    category_id,
    name,
    description,
    price,
    cost_price,
    station,
    images,
    is_active
) VALUES 
(
    'b1111111-1111-1111-1111-111111111111',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'a1111111-1111-1111-1111-111111111111',
    'Hibiscus Spritz',
    'Prosecco, hibiscus cordial, fresh lime, soda and edible petals',
    95.00,
    25.00,
    'bar',
    '["https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80"]'::jsonb,
    true
),
(
    'b2222222-2222-2222-2222-222222222222',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'a2222222-2222-2222-2222-222222222222',
    'Smoky Negroni',
    'Mezcal, Campari, sweet vermouth, smoked orange peel garnish',
    110.00,
    30.00,
    'bar',
    '["https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=600&q=80"]'::jsonb,
    true
),
(
    'b3333333-3333-3333-3333-333333333333',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'a3333333-3333-3333-3333-333333333333',
    'Velvet Burger',
    'Wagyu beef patty, brioche bun, aged cheddar, truffle aioli and hand-cut fries',
    120.00,
    45.00,
    'kitchen',
    '["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"]'::jsonb,
    true
),
(
    'b4444444-4444-4444-4444-444444444444',
    'c07c2c9e-5b12-4f38-89c0-db876c46ae45',
    'a3333333-3333-3333-3333-333333333333',
    'Truffle Fries',
    'Crispy golden fries tossed in black truffle oil, parmesan, and fresh herbs',
    60.00,
    15.00,
    'kitchen',
    '["https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80"]'::jsonb,
    true
)
ON CONFLICT (id) DO NOTHING;
