import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = 'https://uftbkgdyxwhrfplqtfcb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmdGJrZ2R5eHdocmZwbHF0ZmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTU0NjcsImV4cCI6MjA5NjU5MTQ2N30.rbPX0xZahvraegIeqqvgK4Cd_a5NDAX-SVjSWa4XRjo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const venueId = '7a8af35d-37e4-495c-83df-501b582458da'; // bs-resort
  console.log("Seeding mock kitchen orders to bs-resort...");

  // Create a dummy table if none
  let { data: table } = await supabase.from('tables').select('id').eq('venue_id', venueId).limit(1).single();
  if (!table) {
    const { data: newTable } = await supabase.from('tables').insert({
      venue_id: venueId,
      table_number: 1,
      table_label: 'Mock Table',
      capacity: 4,
      area: 'Main',
      qr_code_token: 'MOCK-TOKEN-123',
      is_active: true
    }).select().single();
    table = newTable;
  }

  // Create a dummy category if none
  let { data: cat } = await supabase.from('menu_categories').select('id').eq('venue_id', venueId).limit(1).single();
  if (!cat) {
    const { data: newCat } = await supabase.from('menu_categories').insert({
      venue_id: venueId,
      name: 'Mock Category',
      sort_order: 1,
      is_active: true
    }).select().single();
    cat = newCat;
  }

  // Create dummy products if none
  let { data: products } = await supabase.from('products').select('*').eq('venue_id', venueId).eq('station', 'kitchen').limit(3);
  if (!products || products.length === 0) {
    await supabase.from('products').insert([
      { venue_id: venueId, category_id: cat.id, name: 'Truffle Burger', price: 85, station: 'kitchen', is_active: true, sort_order: 1 },
      { venue_id: venueId, category_id: cat.id, name: 'Crispy Fries', price: 35, station: 'kitchen', is_active: true, sort_order: 2 },
      { venue_id: venueId, category_id: cat.id, name: 'Spicy Wings', price: 65, station: 'kitchen', is_active: true, sort_order: 3 }
    ]);
    const { data: p } = await supabase.from('products').select('*').eq('venue_id', venueId).eq('station', 'kitchen').limit(3);
    products = p;
  }

  // Create a Bill
  const { data: bill, error: billErr } = await supabase.from('bills').insert({
    venue_id: venueId,
    table_id: table.id,
    guest_count: 2,
    status: 'open',
    payment_model: 'POSTPAY',
    subtotal: 0,
    service_charge: 0,
    vat: 0,
    total: 0,
    amount_paid: 0,
    is_merged: false
  }).select().single();
  
  if (billErr || !bill) return console.error("Error creating bill:", billErr);

  // Create a customer session so we can insert orders (satisfies RLS)
  const sessionToken = crypto.randomUUID();
  const { data: session, error: sessErr } = await supabase.from('customer_sessions').insert({
    venue_id: venueId,
    table_id: table.id,
    bill_id: bill.id,
    session_token: sessionToken,
    guest_name: 'Mock Customer',
    status: 'active'
  }).select().single();

  if (sessErr) return console.error("Error creating session:", sessErr);

  // Re-create supabase client WITH the session token header so RLS passes
  const authedSupabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { 'x-session-token': sessionToken } }
  });

  // Create Order Submissions
  const { data: sub1, error: sub1Err } = await authedSupabase.from('order_submissions').insert({
    bill_id: bill.id,
    venue_id: venueId,
    guest_name: 'Mock Order',
    status: 'pending',
    station: 'kitchen',
    priority: true,
    notes: 'VIP guest'
  }).select().single();

  if (sub1Err) return console.error("Error creating sub 1:", sub1Err);

  const { data: sub2, error: sub2Err } = await authedSupabase.from('order_submissions').insert({
    bill_id: bill.id,
    venue_id: venueId,
    guest_name: 'Mock Order',
    status: 'preparing',
    station: 'kitchen',
    priority: false
  }).select().single();

  if (sub2Err) return console.error("Error creating sub 2:", sub2Err);
  
  // Insert Order Items
  await authedSupabase.from('order_items').insert([
    {
      submission_id: sub1.id,
      bill_id: bill.id,
      product_id: products[0].id,
      product_name: products[0].name,
      quantity: 2,
      unit_price: products[0].price,
      line_total: products[0].price * 2,
      notes: 'Extra crispy',
      guest_name: 'Mock Order'
    },
    {
      submission_id: sub1.id,
      bill_id: bill.id,
      product_id: products[1].id,
      product_name: products[1].name,
      quantity: 1,
      unit_price: products[1].price,
      line_total: products[1].price,
      guest_name: 'Mock Order'
    },
    {
      submission_id: sub2.id,
      bill_id: bill.id,
      product_id: (products[2] || products[0]).id,
      product_name: (products[2] || products[0]).name,
      quantity: 1,
      unit_price: (products[2] || products[0]).price,
      line_total: (products[2] || products[0]).price,
      notes: 'No onions',
      guest_name: 'Mock Order'
    }
  ]);

  console.log("Successfully seeded mock kitchen orders for bs-resort!");
}

seed();
