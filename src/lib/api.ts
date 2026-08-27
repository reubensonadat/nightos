import { supabase } from './supabase';
import { cached, cacheInvalidate, TTL } from './cache';

/**
 * Attaches the customer session token header (used by RLS policies) to a
 * query builder. Returns the builder unchanged when no token is present.
 */
function withSession<B extends { setHeader: (name: string, value: string) => unknown }>(
  builder: B,
  sessionToken?: string | null,
): B {
  if (!sessionToken) return builder;
  builder.setHeader('x-session-token', sessionToken);
  return builder;
}

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
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
  brand_text_secondary: string | null;
  brand_danger: string | null;
  brand_light_blue: string | null;
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
  qr_code_token: string;
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
  convenience_fee?: number;
  service_charge: number;
  vat: number;
  total: number;
  amount_paid: number;
  is_merged: boolean;
  merged_into_bill_id: string | null;
  table_pin?: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_activity_at: string;
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
  customer_session_id?: string | null;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifier_snapshot: Record<string, unknown>[];
  modifier_price_adjustment: number;
  line_total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
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
  platform_fee: number;
  fee_settled: boolean;
  created_at: string;
};

export type DbStaff = {
  id: string;
  venue_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'owner' | 'manager' | 'supervisor' | 'waiter' | 'kitchen' | 'bar' | 'cashier';
  pin?: string;
  is_active: boolean;
  max_tables: number;
  area_assignment: string | null;
  hourly_rate: number;
  pay_model: 'hourly' | 'salary';
  salary_amount: number | null;
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

export type DbInventoryItem = {
  id: string;
  venue_id: string;
  product_id: string | null;
  name: string;
  category: string;
  stock_qty: number;
  unit: string;
  reorder_threshold: number;
  unit_cost: number;
  supplier: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbStaffShift = {
  id: string;
  staff_id: string;
  venue_id: string;
  clock_in: string;
  clock_out: string | null;
  cash_balance_start: number;
  cash_balance_end: number | null;
  status: 'active' | 'on_break' | 'closed';
  created_at: string;
};

/** Staff session shape (restored from the auth session; no PIN). */
export type DbStaffSession = {
  id: string;
  name: string;
  role: DbStaff['role'];
  venue_id: string;
  venue_name: string;
  venue_slug: string;
  area_assignment: string | null;
  max_tables: number;
};

/** One active order submission for the kitchen display (joined read). */
export type DbKitchenOrderRow = {
  id: string;
  bill_id: string;
  guest_name: string | null;
  status: 'confirmed' | 'preparing' | 'ready';
  station: string;
  priority: string | null;
  notes: string | null;
  created_at: string;
  order_items: Pick<DbOrderItem, 'product_name' | 'quantity' | 'notes'>[];
  bills:
    | { id: string; waiter_id: string | null; status: string; tables: { table_number: number; table_label: string } | null }
    | { id: string; waiter_id: string | null; status: string; tables: { table_number: number; table_label: string }[] }[]
    | null;
};

export type DbOrderSubmissionWithItems = DbOrderSubmission & {
  order_items: Pick<DbOrderItem, 'product_name' | 'quantity' | 'line_total'>[];
  bills: {
    id: string;
    table_id: string;
    tables:
      | { table_number: number; table_label: string }
      | { table_number: number; table_label: string }[];
  }[] | null;
};

export const db = {
  /* ── Venues ── */
  venueBySlug: (slug: string) =>
    cached<DbVenue>(
      () =>
        supabase
          .from('venues')
          .select(
            'id, owner_id, name, slug, description, logo_url, address, phone, email, payment_model, service_charge_pct, vat_pct, tax_inclusive, currency, timezone, is_active, created_at, updated_at, brand_primary, brand_secondary, brand_accent, brand_text_secondary, brand_danger, brand_light_blue',
          )
          .eq('slug', slug)
          .eq('is_active', true)
          .single(),
      `venue:slug:${slug}`,
      TTL.VENUE,
    ),

  venueById: (id: string) =>
    cached<DbVenue>(
      () =>
        supabase
          .from('venues')
          .select(
            'id, owner_id, name, slug, description, logo_url, address, phone, email, payment_model, service_charge_pct, vat_pct, tax_inclusive, currency, timezone, is_active, created_at, updated_at, brand_primary, brand_secondary, brand_accent, brand_text_secondary, brand_danger, brand_light_blue',
          )
          .eq('id', id)
          .single(),
      `venue:id:${id}`,
      TTL.VENUE,
    ),

  updateVenue: (venueId: string, updates: Partial<DbVenue>) => {
    cacheInvalidate(`venue:id:${venueId}`);
    return supabase
      .from('venues')
      .update(updates)
      .eq('id', venueId)
      .select()
      .single();
  },

  /* ── Tables ── */
  tablesByVenue: (venueId: string) =>
    cached<DbTable[]>(
      () =>
        supabase
          .from('tables')
          .select(
            'id, venue_id, table_number, table_label, capacity, area, pos_x, pos_y, qr_code_url, qr_code_token, is_active, created_at',
          )
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('table_number'),
      `tables:${venueId}`,
      TTL.MENU,
    ),

  tableById: (id: string) =>
    cached<DbTable | null>(
      () =>
        supabase
          .from('tables')
          .select(
            'id, venue_id, table_number, table_label, capacity, area, pos_x, pos_y, qr_code_url, qr_code_token, is_active, created_at',
          )
          .eq('id', id)
          .eq('is_active', true)
          .maybeSingle(),
      `table:id:${id}`,
      TTL.MENU,
    ),

  tableByQrToken: (qrCodeToken: string) =>
    cached<DbTable | null>(
      () =>
        supabase
          .from('tables')
          .select(
            'id, venue_id, table_number, table_label, capacity, area, pos_x, pos_y, qr_code_url, qr_code_token, is_active, created_at',
          )
          .eq('qr_code_token', qrCodeToken)
          .eq('is_active', true)
          .maybeSingle(),
      `table:qr:${qrCodeToken}`,
      TTL.MENU,
    ),

  /* ── Menu ── */
  menuCategories: (venueId: string) =>
    cached<DbMenuCategory[]>(
      () =>
        supabase
          .from('menu_categories')
          .select('id, venue_id, name, sort_order, is_active, created_at')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('sort_order'),
      `menu_cats:${venueId}`,
      TTL.MENU,
    ),

  products: (venueId: string) =>
    cached<DbProduct[]>(
      () =>
        supabase
          .from('products')
          .select(
            'id, venue_id, category_id, name, description, long_description, price, cost_price, images, station, tags, abv, origin, is_active, is_archived, sort_order, created_at, updated_at',
          )
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('sort_order'),
      `products:${venueId}`,
      TTL.MENU,
    ),

  modifierGroups: (venueId: string) =>
    cached<DbModifierGroup[]>(
      () =>
        supabase
          .from('modifier_groups')
          .select('id, venue_id, name, required, multi_select, max_select, sort_order, created_at')
          .eq('venue_id', venueId)
          .order('sort_order'),
      `mod_groups:${venueId}`,
      TTL.MENU,
    ),

  modifierOptions: (groupIds: string[]) => {
    if (groupIds.length === 0) return Promise.resolve({ data: [] as DbModifierOption[], error: null });
    return cached<DbModifierOption[]>(
      () =>
        supabase
          .from('modifier_options')
          .select('id, group_id, name, price_delta, sort_order')
          .in('group_id', groupIds)
          .order('sort_order'),
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
  /* ── Bills ── */
  openBillForTable: (tableId: string) =>
    supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, convenience_fee, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, table_pin, created_at, updated_at, closed_at, last_activity_at',
      )
      .eq('table_id', tableId)
      .in('status', ['open', 'settling'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

  /** Server-side open/claim for the waiter flow: reuses the newest open bill,
   *  claims it if it has no waiter, otherwise creates a new bill owned by the
   *  waiter. Never steals a bill that already has a waiter. */
  openBillForWaiter: async (tableId: string, staffId: string) => {
    cacheInvalidate('bills:');
    const { data: billId, error: rpcErr } = await supabase.rpc('open_bill_for_waiter', {
      p_table_id: tableId,
      p_staff_id: staffId,
    });
    if (rpcErr || !billId) return { data: null, error: rpcErr };
    return supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, convenience_fee, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, table_pin, created_at, updated_at, closed_at, last_activity_at',
      )
      .eq('id', billId)
      .maybeSingle();
  },

  billById: (id: string) =>
    supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, convenience_fee, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, table_pin, created_at, updated_at, closed_at, last_activity_at',
      )
      .eq('id', id)
      .maybeSingle(),

  createBill: (venueId: string, tableId: string, guestCount = 1, sessionToken?: string | null, tablePin?: string | null) => {
    cacheInvalidate('bills:');
    return withSession(
      supabase
        .from('bills')
        .insert({ venue_id: venueId, table_id: tableId, guest_count: guestCount, table_pin: tablePin || null }),
      sessionToken,
    )
      .select()
      .single();
  },

  setBillPin: async (billId: string, pin: string) => {
    cacheInvalidate('bills:');
    return supabase.rpc('set_bill_pin', { p_bill_id: billId, p_pin: pin });
  },

  /**
   * Bills for a venue with pagination: returns one page of up to `pageSize`
   * rows plus the total count (for page buttons).
   */
  billsByVenue: async (venueId: string, page = 0, pageSize = 20) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { count, error: countErr } = await supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .in('status', ['open', 'settling', 'paid']);
    if (countErr) return { data: null, error: countErr, total: 0 };
    const { data, error } = await supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, convenience_fee, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, table_pin, created_at, updated_at, closed_at, last_activity_at',
      )
      .eq('venue_id', venueId)
      .in('status', ['open', 'settling', 'paid'])
      .order('created_at', { ascending: false })
      .range(from, to);
    return { data, error, total: count ?? 0 };
  },

  updateBill: (id: string, updates: Partial<DbBill>, sessionToken?: string | null) => {
    cacheInvalidate('bills:');
    return withSession(supabase.from('bills').update(updates), sessionToken)
      .eq('id', id)
      .select()
      .single();
  },

  /* ── Order Submissions ── */
  createOrderSubmission: (
    billId: string,
    venueId: string,
    station: 'kitchen' | 'bar' | 'both',
    notes?: string,
    customerSessionId?: string | null,
    guestName?: string | null,
    sessionToken?: string | null,
  ) => {
    cacheInvalidate('orders:');
    return withSession(
      supabase
        .from('order_submissions')
        .insert({
          bill_id: billId,
          venue_id: venueId,
          station,
          notes: notes || null,
          customer_session_id: customerSessionId || null,
          guest_name: guestName || null,
        }),
      sessionToken,
    )
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
    sessionToken?: string | null,
  ) => {
    cacheInvalidate('order_items:');
    return withSession(
      supabase
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
        }),
      sessionToken,
    )
      .select()
      .single();
  },

  /**
   * Order submissions for a venue with pagination (newest first). Returns
   * one page of up to `pageSize` rows plus total count (for page buttons).
   */
  orderSubmissionsByVenue: async (venueId: string, station?: string, page = 0, pageSize = 20) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const countQuery = supabase
      .from('order_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId);
    const listQuery = supabase
      .from('order_submissions')
      .select(
        'id, bill_id, venue_id, guest_name, status, station, priority, notes, customer_session_id, created_at, updated_at',
      )
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (station) {
      countQuery.in('station', [station, 'both']);
      listQuery.in('station', [station, 'both']);
    }
    const [{ count, error: countErr }, { data, error }] = await Promise.all([
      countQuery,
      listQuery,
    ]);
    if (countErr) return { data, error: countErr, total: 0 };
    return { data, error, total: count ?? 0 };
  },

  orderItemsBySubmission: (submissionId: string) =>
    supabase
      .from('order_items')
      .select(
        'id, submission_id, bill_id, product_id, product_name, quantity, unit_price, modifier_snapshot, modifier_price_adjustment, line_total, status, notes, guest_name, customer_session_id, created_at',
      )
      .eq('submission_id', submissionId),

  /** All items on a bill, customer-scoped (x-session-token header). Used for
   *  the whole-stay receipt. */
  orderItemsByBill: (billId: string, sessionToken?: string | null) =>
    withSession(
      supabase
        .from('order_items')
        .select(
          'id, submission_id, bill_id, product_id, product_name, quantity, unit_price, modifier_snapshot, modifier_price_adjustment, line_total, status, notes, guest_name, customer_session_id, created_at',
        )
        .eq('bill_id', billId)
        .order('created_at', { ascending: true }),
      sessionToken,
    ),

  /** The customer's own bill row (x-session-token scope) for receipts. */
  customerBill: (billId: string, sessionToken?: string | null) =>
    withSession(
      supabase
        .from('bills')
        .select(
          'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, convenience_fee, service_charge, vat, total, amount_paid, created_at, updated_at, closed_at, tables(id, table_number, table_label)',
        )
        .eq('id', billId)
        .maybeSingle(),
      sessionToken,
    ),

  submissionsByBill: (billId: string, sessionToken?: string | null) =>
    withSession(
      supabase
        .from('order_submissions')
        .select(
          'id, bill_id, venue_id, guest_name, status, station, priority, notes, customer_session_id, created_at, updated_at',
        )
        .eq('bill_id', billId)
        .order('created_at', { ascending: false }),
      sessionToken,
    ),

  billWithTable: (billId: string) =>
    supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, created_at, updated_at, closed_at, last_activity_at, tables!inner(id, table_number, table_label, area)',
      )
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
  paymentsByBill: (billId: string) =>
    supabase
      .from('payments')
      .select('id, bill_id, venue_id, amount, method, reference, payer_name, collected_by, status, paystack_data, platform_fee, fee_settled, created_at')
      .eq('bill_id', billId),

  /** Recent cash payments + table labels — per-order fee ledger for LiveOps. */
  recentCashFees: async (venueId: string, pageSize = 10) => {
    const { data, error } = await supabase.rpc('recent_cash_fees', {
      p_venue_id: venueId,
      p_limit: pageSize,
    });
    return {
      data: (data ?? []) as {
        payment_id: string;
        amount: number;
        platform_fee: number;
        fee_settled: boolean;
        created_at: string;
        table_number: number;
        table_label: string;
      }[],
      error,
    };
  },

  /**
   * Payments for a venue with pagination (newest first): one page of up to
   * `pageSize` rows plus total count.
   */
  paymentsByVenue: async (venueId: string, page = 0, pageSize = 20) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { count, error: countErr } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .eq('status', 'success');
    if (countErr) return { data: null, error: countErr, total: 0 };
    const { data, error } = await supabase
      .from('payments')
      .select(
        'id, bill_id, venue_id, amount, method, reference, payer_name, collected_by, status, paystack_data, platform_fee, fee_settled, created_at',
      )
      .eq('venue_id', venueId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .range(from, to);
    return { data, error, total: count ?? 0 };
  },

  /* ── Staff ── */
  staffByPhone: (phone: string) =>
    supabase
      .from('staff')
      .select(
        'id, venue_id, name, phone, email, role, is_active, max_tables, area_assignment, hourly_rate, pay_model, salary_amount, created_at',
      )
      .eq('phone', phone)
      .maybeSingle(),

  staffByVenue: (venueId: string) =>
    cached<DbStaff[]>(
      () =>
        supabase
          .from('staff')
          .select(
            'id, venue_id, name, phone, email, role, is_active, max_tables, area_assignment, hourly_rate, pay_model, salary_amount, created_at',
          )
          .eq('venue_id', venueId)
          .order('name'),
      `staff:${venueId}`,
      TTL.STAFF,
    ),

  staffNamesByIds: (ids: string[]) => {
    if (ids.length === 0) return Promise.resolve({ data: [] as DbStaff[], error: null });
    return supabase
      .from('staff')
      .select('id, name')
      .in('id', ids);
  },

  /* ── Staff management (owner) ── */
  staffList: (venueId: string) => supabase.rpc('staff_list', { p_venue_id: venueId }),

  createStaff: async (args: {
    venueId: string;
    name: string;
    phone: string;
    role: string;
    email?: string | null;
    hourlyRate?: number;
    maxTables?: number;
    areaAssignment?: string | null;
    payModel?: 'hourly' | 'salary';
    salaryAmount?: number | null;
  }) => {
    cacheInvalidate(`staff:${args.venueId}`);
    const { data, error } = await supabase.rpc('create_staff', {
      p_venue_id: args.venueId,
      p_name: args.name,
      p_phone: args.phone,
      p_role: args.role,
      p_email: args.email || null,
      p_hourly_rate: args.hourlyRate ?? 0,
      p_max_tables: args.maxTables ?? 6,
      p_area_assignment: args.areaAssignment || null,
      p_pay_model: args.payModel ?? 'hourly',
      p_salary_amount: args.salaryAmount ?? null,
    });
    return { data: (data ?? { ok: false, error: 'unknown' }) as { ok: boolean; error?: string; id?: string }, error };
  },

  updateStaff: async (args: {
    staffId: string;
    venueId: string;
    role?: string;
    email?: string | null;
    hourlyRate?: number;
    payModel?: 'hourly' | 'salary';
    salaryAmount?: number | null;
    maxTables?: number;
    areaAssignment?: string | null;
    isActive?: boolean;
  }) => {
    cacheInvalidate(`staff:${args.venueId}`);
    const { data, error } = await supabase.rpc('update_staff', {
      p_staff_id: args.staffId,
      p_role: args.role ?? null,
      p_email: args.email === undefined ? null : args.email,
      p_hourly_rate: args.hourlyRate ?? null,
      p_pay_model: args.payModel ?? null,
      p_salary_amount: args.salaryAmount === undefined ? null : args.salaryAmount,
      p_max_tables: args.maxTables ?? null,
      p_area_assignment: args.areaAssignment === undefined ? null : args.areaAssignment,
      p_is_active: args.isActive ?? null,
    });
    return { data: (data ?? { ok: false, error: 'unknown' }) as { ok: boolean; error?: string }, error };
  },

  setStaffActive: async (staffId: string, active: boolean, venueId: string) => {
    cacheInvalidate(`staff:${venueId}`);
    const { data, error } = await supabase.rpc('set_staff_active', {
      p_staff_id: staffId,
      p_active: active,
    });
    return { data: data as boolean | null, error };
  },

  /* ── Kitchen display ── */
  kitchenOrders: (venueId: string) =>
    supabase
      .from('order_submissions')
      .select(
        `id, bill_id, guest_name, status, station, priority, notes, created_at,
         order_items(product_name, quantity, notes),
         bills!inner(id, waiter_id, status, tables!inner(table_number, table_label))`,
      )
      .eq('venue_id', venueId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false }),

  setOrderStatus: async (submissionId: string, status: string, staffId: string) => {
    cacheInvalidate('orders:');
    const { data, error } = await supabase
      .rpc('set_order_status', {
        p_submission_id: submissionId,
        p_status: status,
        p_staff_id: staffId,
      });
    // RETURNS boolean — PostgREST returns the scalar directly.
    return { data: (data as boolean) ?? false, error };
  },

  /** Staff closes a table: cancels the bill (no successful payments),
   *  closes its sessions, cancels pending submissions. */
  closeBill: async (billId: string, staffId: string) => {
    const { data, error } = await supabase
      .rpc('close_bill', {
        p_bill_id: billId,
        p_staff_id: staffId,
      });
    // RETURNS boolean — PostgREST returns the scalar directly.
    return { ok: (data as boolean) ?? false, error };
  },

  /** Real status of the customer's own submissions (via session token). */
  orderSubmissionStatuses: (ids: string[], sessionToken?: string | null) => {
    if (ids.length === 0) return Promise.resolve({ data: [] as { id: string; status: string }[], error: null });
    return withSession(
      supabase
        .from('order_submissions')
        .select('id, status, updated_at')
        .in('id', ids),
      sessionToken,
    ) as unknown as Promise<{
      data: { id: string; status: string; updated_at: string | null }[] | null;
      error: unknown;
    }>;
  },

  /* ── Cash settlement + platform fees ── */
  billItems: (billId: string) =>
    supabase
      .from('order_items')
      .select('id, submission_id, bill_id, product_id, product_name, quantity, unit_price, modifier_snapshot, modifier_price_adjustment, line_total, notes, guest_name, customer_session_id, created_at')
      .eq('bill_id', billId)
      .order('created_at'),

  recordCashPayment: async (billId: string, amount: number, staffId?: string | null, payerName?: string) => {
    cacheInvalidate('bills:');
    cacheInvalidate('payments:');
    const { data, error } = await supabase.rpc('record_cash_payment', {
      p_bill_id: billId,
      p_amount: amount,
      p_staff_id: staffId && staffId.trim() ? staffId : null,
      p_payer_name: payerName ?? null,
    });
    return {
      data: (data ?? { ok: false, error: 'no_response' }) as {
        ok: boolean;
        error?: string;
        fee?: number;
        bill_status?: string;
        remaining?: number;
      },
      error,
    };
  },

  expireStaleSessions: async () => {
    const { data, error } = await supabase.rpc('expire_stale_sessions');
    return { data: typeof data === 'number' ? data : 0, error };
  },

  outstandingBalance: async (venueId: string) => {
    const { data, error } = await supabase.rpc('outstanding_balance', { p_venue_id: venueId });
    return { data: typeof data === 'number' ? data : Number(data ?? 0), error };
  },

  landedWithoutOrders: async (venueId: string) => {
    const { data, error } = await supabase.rpc('landed_without_orders', { p_venue_id: venueId });
    return {
      data: (data ?? []) as {
        session_id: string;
        table_number: number;
        table_label: string;
        created_at: string;
        age_minutes: number;
      }[],
      error,
    };
  },

  openBillOverview: async (venueId: string) => {
    const { data, error } = await supabase.rpc('open_bill_overview', { p_venue_id: venueId });
    return {
      data: (data ?? []) as {
        bill_id: string;
        table_number: number;
        table_label: string;
        guests: number;
        waiter_name: string | null;
        total: number;
        amount_paid: number;
        age_minutes: number;
        last_activity_at: string;
        dwell_minutes: number;
        is_merged: boolean;
        merged_into_bill_id: string | null;
      }[],
      error,
    };
  },

  /** Reads a venue_settings key (e.g. max_dwell_minutes) — staff-safe RPC. */
  getVenueSetting: async (venueId: string, key: string, fallback: number) => {
    const { data, error } = await supabase.rpc('get_venue_setting', {
      p_venue_id: venueId,
      p_key: key,
      p_default: fallback,
    });
    const raw = data === null || data === undefined ? fallback : Number(data);
    return { data: Number.isFinite(raw) ? raw : fallback, error };
  },

  /* ── Table operations (waiter) ── */
  transferBill: async (billId: string, destTableId: string, staffId?: string | null) => {
    cacheInvalidate('bills:');
    const { data, error } = await supabase.rpc('transfer_bill', {
      p_bill_id: billId,
      p_dest_table_id: destTableId,
      p_staff_id: staffId && staffId.trim() ? staffId : null,
    });
    return { data: (data ?? { ok: false, error: 'no_response' }) as { ok: boolean; error?: string }, error };
  },

  mergeBills: async (sourceBillId: string, destBillId: string, staffId?: string | null) => {
    cacheInvalidate('bills:');
    cacheInvalidate('orders:');
    const { data, error } = await supabase.rpc('merge_bills', {
      p_source_bill_id: sourceBillId,
      p_dest_bill_id: destBillId,
      p_staff_id: staffId && staffId.trim() ? staffId : null,
    });
    return { data: (data ?? { ok: false, error: 'no_response' }) as { ok: boolean; error?: string }, error };
  },

  splitBill: async (billId: string, ways: number, staffId?: string | null) => {
    cacheInvalidate('bills:');
    cacheInvalidate('orders:');
    const { data, error } = await supabase.rpc('split_bill', {
      p_bill_id: billId,
      p_ways: ways,
      p_staff_id: staffId && staffId.trim() ? staffId : null,
    });
    return { data: (data ?? { ok: false, error: 'no_response' }) as { ok: boolean; error?: string }, error };
  },

  /* ── Manager Dashboard (raw rows, math done in the frontend) ── */
  paymentsSince: async (venueId: string, sinceIso: string) => {
    const { data, error } = await supabase
      .from('payments')
      .select('id, bill_id, venue_id, amount, method, reference, payer_name, collected_by, status, paystack_data, platform_fee, fee_settled, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'success')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  orderSubmissionsSince: async (venueId: string, sinceIso: string) => {
    const { data, error } = await supabase
      .from('order_submissions')
      .select(
        `id, bill_id, venue_id, guest_name, status, station, priority, notes, customer_session_id, created_at, updated_at,
         order_items(product_name, quantity, line_total),
         bills!inner(id, table_id, tables!inner(table_number, table_label))`,
      )
      .eq('venue_id', venueId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  billsSince: async (venueId: string, sinceIso: string) => {
    const { data, error } = await supabase
      .from('bills')
      .select(
        'id, venue_id, table_id, waiter_id, guest_count, status, payment_model, subtotal, service_charge, vat, total, amount_paid, is_merged, merged_into_bill_id, created_at, updated_at, closed_at, last_activity_at',
      )
      .eq('venue_id', venueId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  inventoryByVenue: (venueId: string) =>
    cached<DbInventoryItem[]>(
      () =>
        supabase
          .from('inventory_items')
          .select(
            'id, venue_id, product_id, name, category, stock_qty, unit, reorder_threshold, unit_cost, supplier, is_active, created_at, updated_at',
          )
          .eq('venue_id', venueId)
          .order('name'),
      `inventory:${venueId}`,
      TTL.STAFF,
    ),

  activeShiftsByVenue: (venueId: string) =>
    supabase
      .from('staff_shifts')
      .select(
        'id, staff_id, venue_id, clock_in, clock_out, cash_balance_start, cash_balance_end, status, created_at',
      )
      .eq('venue_id', venueId)
      .in('status', ['active', 'on_break']),

  /** Idempotent clock-in: called on sign-in / session boot. */
  clockInStaff: async (staffId: string) => {
    const { data, error } = await supabase.rpc('clock_in_staff', { p_staff_id: staffId });
    return { data: (data as boolean) ?? false, error };
  },

  /** Clock-out: closes the active shift on sign-out. */
  clockOutStaff: async (staffId: string) => {
    const { data, error } = await supabase.rpc('clock_out_staff', { p_staff_id: staffId });
    return { data: (data as boolean) ?? false, error };
  },

  /** Approve a staff shift (owner/manager/supervisor only). approve=false = take off duty. */
  approveShift: async (shiftId: string, approve = true) => {
    const { data, error } = await supabase.rpc('approve_shift', {
      p_shift_id: shiftId,
      p_approve: approve,
    });
    return { data: (data as boolean) ?? false, error };
  },

  /** Who is on duty / pending / off, with live open-bill counts (manager panel). */
  shiftCoverage: (venueId: string) =>
    supabase.rpc('shift_coverage', { p_venue_id: venueId }),

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
      }),

  reservationsByPhone: async (phone: string) => {
    const { data, error } = await supabase.rpc('reservations_by_phone', { p_phone: phone });
    return {
      data: (data ?? []) as {
        id: string;
        customer_name: string;
        guest_count: number;
        seating_area: string | null;
        reservation_date: string;
        reservation_time: string;
        status: string;
        created_at: string;
      }[],
      error,
    };
  },

  /* ── Event ticket stock (What's On tab) ── */
  eventTickets: (venueId: string) =>
    supabase
      .from('event_tickets')
      .select(
        'id, venue_id, event_name, event_date, event_time, ticket_type, price, description, is_active',
      )
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('event_date'),

  reservationsByVenue: (venueId: string) =>
    supabase
      .from('reservations')
      .select(
        'id, venue_id, table_id, customer_name, customer_phone, customer_email, guest_count, seating_area, reservation_date, reservation_time, status, deposit_amount, deposit_paid, notes, created_at',
      )
      .eq('venue_id', venueId)
      .order('reservation_date', { ascending: false }),

  /* ── Customers ── */
  findOrCreateCustomer: (venueId: string, phone: string, name?: string) =>
    supabase.rpc('find_or_create_customer', {
      p_venue_id: venueId,
      p_phone: phone,
      p_name: name || null,
    }),

  /**
   * Customers for a venue with pagination: one page of up to `pageSize`
   * rows (by total spend, descending) plus total count.
   */
  customersByVenue: async (venueId: string, page = 0, pageSize = 20) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { count, error: countErr } = await supabase
      .from('customer_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId);
    if (countErr) return { data: null, error: countErr, total: 0 };
    const { data, error } = await supabase
      .from('customer_profiles')
      .select(
        'id, venue_id, name, phone, email, total_visits, total_spend, loyalty_tier, is_vip, notes, created_at, updated_at',
      )
      .eq('venue_id', venueId)
      .order('total_spend', { ascending: false })
      .range(from, to);
    return { data, error, total: count ?? 0 };
  },

  /* ── Staff shift summary (real waiter performance) ── */
  staffShiftSummary: async (staffId: string) => {
    const { data, error } = await supabase.rpc('staff_shift_summary', {
      p_staff_id: staffId && staffId.trim() ? staffId : null,
    });
    return {
      data: (data ?? { ok: false, error: 'no_response' }) as {
        ok: boolean;
        error?: string;
        sales: number;
        tables_served: number;
        items_sold: number;
        shift_seconds: number;
        activity: { type: 'settlement' | 'table' | 'tip'; label: string; amount: number; ts: string }[];
      },
      error,
    };
  },

  /* ── Payments & expenses (financial reports) ── */
  paymentsAll: (venueId: string, from = 0, to = 499, sinceIso?: string) =>
    supabase
      .from('payments')
      .select(
        'id, bill_id, venue_id, payer_name, amount, method, reference, status, collected_by, created_at',
      )
      .eq('venue_id', venueId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .range(from, to)
      .then(({ data, error }) =>
        sinceIso && data
          ? { data: data.filter((p) => p.created_at >= sinceIso), error }
          : { data, error },
      ),

  expensesByVenue: (venueId: string, sinceIso?: string, limit = 500) =>
    supabase
      .from('expenses')
      .select(
        'id, venue_id, category, amount, description, expense_date, created_at',
      )
      .eq('venue_id', venueId)
      .order('expense_date', { ascending: false })
      .limit(limit)
      .then(({ data, error }) =>
        sinceIso && data
          ? { data: data.filter((e) => e.expense_date >= sinceIso), error }
          : { data, error },
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
};

export type Db = typeof db;
