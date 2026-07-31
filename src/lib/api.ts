import { supabase } from './supabase';
import { cached, cacheInvalidate, TTL } from './cache';

export type DbVenue = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  payment_model: 'PREPAY' | 'POSTPAY';
  service_charge_pct: number;
  vat_pct: number;
  tax_inclusive: boolean;
  currency: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbTable = {
  id: string;
  venue_id: string;
  table_number: number;
  table_label: string;
  capacity: number;
  area: string;
  pos_x: number | null;
  pos_y: number | null;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type DbMenuCategory = {
  id: string;
  venue_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type DbProduct = {
  id: string;
  venue_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  long_description: string | null;
  price: number;
  cost_price: number | null;
  images: string[];
  station: 'kitchen' | 'bar' | 'both';
  tags: string[];
  abv: string | null;
  origin: string | null;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DbModifierGroup = {
  id: string;
  venue_id: string;
  name: string;
  required: boolean;
  multi_select: boolean;
  max_select: number | null;
  sort_order: number;
  created_at: string;
};

export type DbModifierOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
};

export type DbBill = {
  id: string;
  venue_id: string;
  table_id: string;
  waiter_id: string | null;
  guest_count: number;
  status: 'open' | 'settling' | 'paid' | 'cancelled';
  payment_model: 'PREPAY' | 'POSTPAY';
  subtotal: number;
  service_charge: number;
  vat: number;
  convenience_fee: number;
  total: number;
  amount_paid: number;
  is_merged: boolean;
  merged_into_bill_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type DbOrderSubmission = {
  id: string;
  bill_id: string;
  venue_id: string;
  guest_name: string | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  station: 'kitchen' | 'bar' | 'both';
  priority: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbOrderItem = {
  id: string;
  submission_id: string;
  bill_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifier_snapshot: Record<string, unknown>[];
  modifier_price_adjustment: number;
  line_total: number;
  notes: string | null;
  guest_name: string | null;
  created_at: string;
};

export type DbPayment = {
  id: string;
  bill_id: string;
  venue_id: string;
  amount: number;
  method: 'mobile_money' | 'card' | 'bank_transfer' | 'digital_wallet' | 'cash';
  reference: string | null;
  payer_name: string | null;
  collected_by: string | null;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  paystack_data: Record<string, unknown> | null;
  created_at: string;
};

export type DbStaff = {
  id: string;
  venue_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'owner' | 'manager' | 'supervisor' | 'waiter' | 'kitchen' | 'bar' | 'cashier';
  pin: string;
  is_active: boolean;
  max_tables: number;
  area_assignment: string | null;
  hourly_rate: number;
  created_at: string;
};

export type DbReservation = {
  id: string;
  venue_id: string;
  table_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  guest_count: number;
  seating_area: string | null;
  reservation_date: string;
  reservation_time: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  deposit_amount: number;
  deposit_paid: boolean;
  notes: string | null;
  created_at: string;
};

export type DbCustomerProfile = {
  id: string;
  venue_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  total_visits: number;
  total_spend: number;
  loyalty_tier: 'new' | 'regular' | 'loyal' | 'vip';
  is_vip: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbCustomerSession = {
  id: string;
  venue_id: string;
  table_id: string;
  bill_id: string | null;
  guest_name: string;
  party_size: number;
  session_token: string;
  status: 'active' | 'closed';
  created_at: string;
  last_active_at: string;
};

export const db = {
  /* ── Venues ── */
  venueBySlug: (slug: string) =>
    cached<DbVenue>(
      async () => await supabase.from('venues').select('*').eq('slug', slug).eq('is_active', true).single(),
      `venue:slug:${slug}`,
      TTL.VENUE,
    ),

  venueById: (id: string) =>
    cached<DbVenue>(
      async () => await supabase.from('venues').select('*').eq('id', id).single(),
      `venue:id:${id}`,
      TTL.VENUE,
    ),

  /* ── Tables ── */
  tablesByVenue: (venueId: string) =>
    cached<DbTable[]>(
      async () =>
        await supabase
          .from('tables')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('table_number'),
      `tables:${venueId}`,
      TTL.MENU,
    ),



  /* ── Menu ── */
  menuCategories: (venueId: string) =>
    cached<DbMenuCategory[]>(
      async () =>
        await supabase
          .from('menu_categories')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('sort_order'),
      `menu_cats:${venueId}`,
      TTL.MENU,
    ),

  products: (venueId: string) =>
    cached<DbProduct[]>(
      async () =>
        await supabase
          .from('products')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('sort_order'),
      `products:${venueId}`,
      TTL.MENU,
    ),

  modifierGroups: (venueId: string) =>
    cached<DbModifierGroup[]>(
      async () =>
        await supabase
          .from('modifier_groups')
          .select('*')
          .eq('venue_id', venueId)
          .order('sort_order'),
      `mod_groups:${venueId}`,
      TTL.MENU,
    ),

  modifierOptions: (groupIds: string[]) => {
    if (groupIds.length === 0) return Promise.resolve({ data: [] as DbModifierOption[], error: null });
    return cached<DbModifierOption[]>(
      async () =>
        await supabase.from('modifier_options').select('*').in('group_id', groupIds).order('sort_order'),
      `mod_options:${groupIds.sort().join(',')}`,
      TTL.MENU,
    );
  },

  productModifiers: (productId: string) =>
    cached<string[]>(
      async () => {
        const { data, error } = await supabase
          .from('product_modifiers')
          .select('group_id')
          .eq('product_id', productId);
        return { data: data?.map((pm) => pm.group_id) ?? [], error };
      },
      `prod_mods:${productId}`,
      TTL.MENU,
    ),

  /* ── Bills ── */
  openBillForTable: (tableId: string) =>
    supabase
      .from('bills')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['open', 'settling'])
      .maybeSingle(),

  createBill: (venueId: string, tableId: string, guestCount = 1) => {
    cacheInvalidate('bills:');
    return supabase
      .from('bills')
      .insert({ venue_id: venueId, table_id: tableId, guest_count: guestCount })
      .select()
      .single();
  },

  billsByVenue: (venueId: string) =>
    supabase
      .from('bills')
      .select('*')
      .eq('venue_id', venueId)
      .in('status', ['open', 'settling'])
      .order('created_at', { ascending: false }),

  updateBill: (id: string, updates: Partial<DbBill>) => {
    cacheInvalidate('bills:');
    return supabase.from('bills').update(updates).eq('id', id).select().single();
  },

  /* ── Order Submissions ── */
  createOrderSubmission: (
    billId: string,
    venueId: string,
    station: 'kitchen' | 'bar' | 'both',
    notes?: string,
    customerSessionId?: string | null,
    guestName?: string | null,
  ) => {
    cacheInvalidate('orders:');
    return supabase
      .from('order_submissions')
      .insert({
        bill_id: billId,
        venue_id: venueId,
        station,
        notes: notes || null,
        customer_session_id: customerSessionId || null,
        guest_name: guestName || null
      })
      .select()
      .single();
  },

  createOrderItem: (
    submissionId: string,
    billId: string,
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: number,
    modifierSnapshot: Record<string, unknown>[],
    modifierPriceAdjustment: number,
    lineTotal: number,
    notes?: string,
    customerSessionId?: string | null,
    guestName?: string | null,
  ) => {
    cacheInvalidate('order_items:');
    return supabase
      .from('order_items')
      .insert({
        submission_id: submissionId,
        bill_id: billId,
        product_id: productId,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        modifier_snapshot: modifierSnapshot,
        modifier_price_adjustment: modifierPriceAdjustment,
        line_total: lineTotal,
        notes: notes || null,
        customer_session_id: customerSessionId || null,
        guest_name: guestName || null
      })
      .select()
      .single();
  },

  orderSubmissionsByVenue: (venueId: string, station?: string) => {
    let query = supabase
      .from('order_submissions')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });
    if (station) query = query.in('station', [station, 'both']);
    return query;
  },

  orderItemsBySubmission: (submissionId: string) =>
    supabase.from('order_items').select('*').eq('submission_id', submissionId),

  billWithTable: (billId: string) =>
    supabase
      .from('bills')
      .select('*, tables!inner(*)')
      .eq('id', billId)
      .single(),

  updateOrderSubmissionStatus: (id: string, status: DbOrderSubmission['status']) => {
    cacheInvalidate('orders:');
    return supabase
      .from('order_submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  },

  /* ── Payments ── */
  createPayment: (
    billId: string,
    venueId: string,
    amount: number,
    method: DbPayment['method'],
    reference?: string,
    payerName?: string,
  ) => {
    cacheInvalidate('bills:');
    return supabase
      .from('payments')
      .insert({
        bill_id: billId,
        venue_id: venueId,
        amount,
        method,
        reference: reference || null,
        payer_name: payerName || null,
        status: 'success',
      })
      .select()
      .single();
  },

  paymentsByBill: (billId: string) =>
    supabase.from('payments').select('*').eq('bill_id', billId),

  /* ── Staff ── */
  staffByPhone: (phone: string) =>
    supabase.from('staff').select('*').eq('phone', phone).maybeSingle(),

  staffByPhoneRpc: (phone: string) =>
    supabase.rpc('get_staff_by_phone', { p_phone: phone }),

  staffByVenue: (venueId: string) =>
    cached<DbStaff[]>(
      async () => await supabase.from('staff').select('*').eq('venue_id', venueId).order('name'),
      `staff:${venueId}`,
      TTL.STAFF,
    ),

  /* ── Reservations ── */
  createReservation: (
    venueId: string,
    customerName: string,
    guestCount: number,
    reservationDate: string,
    reservationTime: string,
    customerPhone?: string,
    customerEmail?: string,
    notes?: string,
  ) =>
    supabase
      .from('reservations')
      .insert({
        venue_id: venueId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        guest_count: guestCount,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        notes: notes || null,
      })
      .select()
      .single(),

  reservationsByVenue: (venueId: string) =>
    supabase
      .from('reservations')
      .select('*')
      .eq('venue_id', venueId)
      .order('reservation_date', { ascending: false }),

  /* ── Customers ── */
  findOrCreateCustomer: (venueId: string, phone: string, name?: string) =>
    supabase.rpc('find_or_create_customer', {
      p_venue_id: venueId,
      p_phone: phone,
      p_name: name || null,
    }),

  customersByVenue: (venueId: string) =>
    cached<DbCustomerProfile[]>(
      async () =>
        await supabase
          .from('customer_profiles')
          .select('*')
          .eq('venue_id', venueId)
          .order('total_spend', { ascending: false }),
      `customers:${venueId}`,
      TTL.DASHBOARD,
    ),

  /* ── Edge Functions ── */
  verifyPayment: (reference: string, billId: string) =>
    supabase.functions.invoke('verify-payment', {
      body: { reference, bill_id: billId },
    }),

  assignWaiter: (billId: string) =>
    supabase.functions.invoke('assign-waiter', {
      body: { bill_id: billId },
    }),

  getTableById: (tableId: string) =>
    supabase.from('tables').select('*, venues(*)').eq('id', tableId).single(),

  getOrCreateTableSession: (
    venueSlug: string,
    tableId: string,
    token: string,
    guestName: string,
    partySize: number
  ) =>
    supabase.rpc('get_or_create_table_session', {
      p_venue_slug: venueSlug,
      p_table_id: tableId,
      p_token: token,
      p_guest_name: guestName,
      p_party_size: partySize,
    }),

  closeTableSession: (sessionId: string) =>
    supabase
      .from('customer_sessions')
      .update({ status: 'closed' })
      .eq('id', sessionId),
};

export type Db = typeof db;
