import { useCallback, useEffect, useRef, useState } from 'react';
import { db, type DbOrderSubmissionWithItems, type DbPayment } from '../lib/api';
import { useRealtime } from './useRealtime';

/* ═══════════════════════════════════════════════════════════════════
   Manager dashboard — pulls RAW rows from Supabase and does all the
   aggregation/math in the frontend, so every number on the dashboard
   comes from real data. Refreshes on Realtime events (no polling).
   ═══════════════════════════════════════════════════════════════════ */

export type DashboardTopItem = {
  name: string;
  sold: number;
  revenue: number;
  pct: number;
};

export type DashboardRecentOrder = {
  id: string;
  ref: string;
  customer: string;
  table: string;
  amount: number;
  status: DbOrderSubmissionWithItems['status'];
  time: string;
  items: number;
};

export type DashboardStats = {
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueTrend: number;
  openOrders: number;
  occupiedTables: number;
  totalTables: number;
  avgWait: number;
  totalStaff: number;
  staffOnShift: number;
  waitersOnFloor: number;
  kitchenStaff: number;
  bartenders: number;
  lowStockCount: number;
  lowStockItems: { id: string; name: string; stock: number; threshold: number }[];
  weeklyRevenue: { day: string; revenue: number; orders: number }[];
  topItems: DashboardTopItem[];
  recentOrders: DashboardRecentOrder[];
  ordersTakenToday: number;
  paymentsToday: number;
  avgOrderValue: number;
  guestsServed: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

const SCOPED_STATUSES = ['pending', 'confirmed', 'preparing'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return d.toDateString();
}

function minsSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function timeAgo(iso: string): string {
  const m = minsSince(iso);
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.floor(m)} min ago`;
  return `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m ago`;
}

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  served: 4,
  cancelled: 5,
};

export function useManagerDashboard(venueId: string | null, days: 7 | 30 = 7) {
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    yesterdayRevenue: 0,
    revenueTrend: 0,
    openOrders: 0,
    occupiedTables: 0,
    totalTables: 0,
    avgWait: 0,
    totalStaff: 0,
    staffOnShift: 0,
    waitersOnFloor: 0,
    kitchenStaff: 0,
    bartenders: 0,
    lowStockCount: 0,
    lowStockItems: [],
    weeklyRevenue: [],
    topItems: [],
    recentOrders: [],
    ordersTakenToday: 0,
    paymentsToday: 0,
    avgOrderValue: 0,
    guestsServed: 0,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    if (!venueId || venueId === '00000000-0000-0000-0000-000000000000') return;
    abortRef.current?.abort();

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const yesterdayStart = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    setStats((s) => ({ ...s, loading: true, error: null }));

    const [paymentsRes, submissionsRes, billsRes, tablesRes, inventoryRes, staffRes, shiftsRes] =
      await Promise.all([
        db.paymentsSince(venueId, since),
        db.orderSubmissionsSince(venueId, since),
        db.billsSince(venueId, since),
        db.tablesByVenue(venueId),
        db.inventoryByVenue(venueId),
        db.staffByVenue(venueId),
        db.activeShiftsByVenue(venueId),
      ]);

    if (abortRef.current?.signal.aborted) return;

    const payments = (paymentsRes.data ?? []) as DbPayment[];
    const submissions = (submissionsRes.data ?? []) as DbOrderSubmissionWithItems[];
    const bills = billsRes.data ?? [];
    const tables = tablesRes.data ?? [];
    const inventory = inventoryRes.data ?? [];
    const staff = staffRes.data ?? [];
    const shifts = shiftsRes.data ?? [];

    const error =
      paymentsRes.error || submissionsRes.error || billsRes.error || tablesRes.error ||
      inventoryRes.error || staffRes.error || shiftsRes.error
        ? 'Some dashboard data could not be loaded'
        : null;

    /* ── Revenue: today vs yesterday (successful payments only) ── */
    const todayRevenue = payments
      .filter((p) => dayKey(new Date(p.created_at)) === dayKey(now))
      .reduce((s, p) => s + p.amount, 0);
    const yesterdayRevenue = payments
      .filter((p) => dayKey(new Date(p.created_at)) === dayKey(yesterdayStart))
      .reduce((s, p) => s + p.amount, 0);
    const revenueTrend = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0 ? 100 : 0;

    /* ── Open orders + average wait ── */
    const open = submissions.filter((s) => SCOPED_STATUSES.includes(s.status));
    const openOrders = open.length;
    const avgWait = open.length
      ? open.reduce((s, o) => s + minsSince(o.created_at), 0) / open.length
      : 0;

    /* ── Occupancy ── */
    const openBillTableIds = new Set(
      bills.filter((b) => b.status === 'open' || b.status === 'settling').map((b) => b.table_id),
    );
    const occupiedTables = openBillTableIds.size;
    const totalTables = tables.length;

    /* ── Low stock ── */
    const lowStock = inventory.filter((i) => i.is_active && i.stock_qty <= i.reorder_threshold);
    const lowStockItems = lowStock.map((i) => ({
      id: i.id,
      name: i.name,
      stock: i.stock_qty,
      threshold: i.reorder_threshold,
    }));

    /* ── Daily revenue chart buckets (7 or 30 days) ── */
    const dayBuckets: { day: string; revenue: number; orders: number; key: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayBuckets.push({
        key: dayKey(d),
        day: days <= 7
          ? d.toLocaleDateString('en-GB', { weekday: 'short' })
          : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        revenue: 0,
        orders: 0,
      });
    }
    for (const p of payments) dayBuckets.find((b) => b.key === dayKey(new Date(p.created_at)))!.revenue += p.amount;
    for (const s of submissions) {
      const b = dayBuckets.find((x) => x.key === dayKey(new Date(s.created_at)));
      if (b) b.orders += 1;
    }
    const weeklyRevenue = dayBuckets.map(({ day, revenue, orders }) => ({ day, revenue, orders }));

    /* ── Top sellers (by revenue, selected window) ── */
    const itemMap = new Map<string, { sold: number; revenue: number }>();
    for (const s of submissions) {
      for (const it of s.order_items ?? []) {
        const cur = itemMap.get(it.product_name) ?? { sold: 0, revenue: 0 };
        cur.sold += it.quantity;
        cur.revenue += it.line_total;
        itemMap.set(it.product_name, cur);
      }
    }
    const topRaw = [...itemMap.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);
    const maxRevenue = topRaw[0]?.[1].revenue || 0;
    const topItems = topRaw.map(([name, v]) => ({
      name,
      sold: v.sold,
      revenue: v.revenue,
      pct: maxRevenue > 0 ? Math.round((v.revenue / maxRevenue) * 100) : 0,
    }));

    /* ── Recent orders (newest 8) ── */
    const recentOrders: DashboardRecentOrder[] = submissions.slice(0, 8).map((s, i) => {
      const bill = Array.isArray(s.bills) ? s.bills[0] : s.bills;
      const tbl = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
      return {
        id: s.id,
        ref: `#V-${s.id.slice(0, 4).toUpperCase()}-${(submissions.length - i).toString().padStart(2, '0')}`,
        customer: s.guest_name || 'Walk-in',
        table: `T-${String(tbl?.table_number ?? '—').padStart(2, '0')}`,
        amount: (s.order_items ?? []).reduce((sum, it) => sum + it.line_total, 0),
        status: s.status,
        time: timeAgo(s.created_at),
        items: (s.order_items ?? []).reduce((sum, it) => sum + it.quantity, 0),
      };
    });

    /* ── Staff ── */
    const shiftStaffIds = new Set(shifts.map((sh) => sh.staff_id));
    const staffOnShift = shiftStaffIds.size;
    const countRole = (roles: string[]) =>
      staff.filter((m) => roles.includes(m.role) && shiftStaffIds.has(m.id)).length;
    const waitersOnFloor = countRole(['waiter']);
    const kitchenStaff = countRole(['kitchen']);
    const bartenders = countRole(['bar', 'cashier']);

    /* ── Today's numbers ── */
    const ordersTakenToday = submissions.filter(
      (s) => dayKey(new Date(s.created_at)) === dayKey(now),
    ).length;
    const paymentsToday = payments.filter(
      (p) => dayKey(new Date(p.created_at)) === dayKey(now),
    ).length;
    const avgOrderValue = ordersTakenToday > 0 ? todayRevenue / ordersTakenToday : 0;
    const guestsServed = bills
      .filter((b) => b.status === 'paid' && dayKey(new Date(b.closed_at ?? b.created_at)) === dayKey(now))
      .reduce((s, b) => s + b.guest_count, 0);

    setStats((prev) => ({
      ...prev,
      todayRevenue,
      yesterdayRevenue,
      revenueTrend,
      openOrders,
      occupiedTables,
      totalTables,
      avgWait,
      totalStaff: staff.length,
      staffOnShift,
      waitersOnFloor,
      kitchenStaff,
      bartenders,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      weeklyRevenue,
      topItems,
      recentOrders,
      ordersTakenToday,
      paymentsToday,
      avgOrderValue,
      guestsServed,
      loading: false,
      error,
      lastUpdated: new Date(),
    }));
  }, [venueId, days]);

  useEffect(() => {
    const init = async () => {
        await fetchAll();
    };
    init();
    }, [fetchAll]);

  // Live refresh: any change to bills / payments / submissions in this
  // venue reloads the numbers (debounced so bursts collapse into one).
  const reloadTimer = useRef<number | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = null;
      fetchAll();
    }, 600);
  }, [fetchAll]);

  const vId = venueId ?? 'none';
  useRealtime({ table: 'bills', filter: `venue_id=eq.${vId}`, onInsert: scheduleReload, onUpdate: scheduleReload });
  useRealtime({ table: 'payments', filter: `venue_id=eq.${vId}`, onInsert: scheduleReload, onUpdate: scheduleReload });
  useRealtime({
    table: 'order_submissions',
    filter: `venue_id=eq.${vId}`,
    onInsert: scheduleReload,
    onUpdate: scheduleReload,
    onDelete: scheduleReload,
  });

  return { ...stats, refresh: fetchAll };
}

export { STATUS_ORDER };
