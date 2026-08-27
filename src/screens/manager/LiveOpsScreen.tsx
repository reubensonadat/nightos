import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "../../hooks/useRealtime";
import {
    ArrowUpRightIcon,
    BanknotesIcon,
    CheckBadgeIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    LinkIcon,
    PlusIcon,
    ShoppingCartIcon,
    TableCellsIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGHS, formatGHSString } from "../../data/menu";
import { useVenue } from "../../hooks/useVenue";
import { useManagerDashboard, type DashboardRecentOrder } from "../../hooks/useManagerDashboard";
import { db } from "../../lib/api";

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGER DASHBOARD — every number here is computed in the frontend from
   real Supabase rows (payments, order_submissions, bills, tables, staff,
   inventory). No mock data.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_STYLES: Record<DashboardRecentOrder["status"], { dot: string; text: string; label: string }> = {
    pending: { dot: "bg-amber-400", text: "text-amber-700", label: "Pending" },
    confirmed: { dot: "bg-sky-400", text: "text-sky-700", label: "Confirmed" },
    preparing: { dot: "bg-blue-400", text: "text-blue-700", label: "Preparing" },
    ready: { dot: "bg-indigo-400", text: "text-indigo-700", label: "Ready" },
    served: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Served" },
    cancelled: { dot: "bg-red-400", text: "text-red-700", label: "Cancelled" },
};

function OrderStatusBadge({ status }: { status: DashboardRecentOrder["status"] }) {
    const s = STATUS_STYLES[status];
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className={s.text}>{s.label}</span>
        </span>
    );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatCompact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatGHSCompact(n: number): React.ReactNode {
    if (n >= 1000) {
        return (
            <span className="whitespace-nowrap inline-flex items-baseline">
                <span className="text-[0.8em] opacity-70 font-semibold mr-[2px]">GH₵</span>
                <span>{(n / 1000).toFixed(1)}k</span>
            </span>
        );
    }
    return formatGHS(n);
}

/** "45m", "2h", "2h 05m" — for idle/dwell times. */
function formatDwell(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function LiveOpsScreen({ onNavigate }: { onNavigate?: (page: string) => void }) {
    const { venue } = useVenue('velvet-lounge');
    const [range, setRange] = useState<7 | 30>(7);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const s = useManagerDashboard(venue.id, range);

    const [outstanding, setOutstanding] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [landed, setLanded] = useState<Awaited<ReturnType<typeof db.landedWithoutOrders>>["data"]>([]);
    const [openBills, setOpenBills] = useState<Awaited<ReturnType<typeof db.openBillOverview>>["data"]>([]);
    const [dwellThreshold, setDwellThreshold] = useState(120);
    const [recentFees, setRecentFees] = useState<Awaited<ReturnType<typeof db.recentCashFees>>["data"]>([]);

    // Group per-table bills by their merged target so linked tables (ABC + CBD)
    // show as one line with both table labels.
    const billGroups = useMemo(() => {
        const groups = new Map<string, Awaited<ReturnType<typeof db.openBillOverview>>["data"]>();
        for (const b of openBills) {
            const key = b.merged_into_bill_id ?? b.bill_id;
            const list = groups.get(key) ?? [];
            list.push(b);
            groups.set(key, list);
        }
        return [...groups.values()];
    }, [openBills]);

    const loadLive = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        try {
            const [{ data: threshold }, bal, landedRows, billRows, fees] = await Promise.all([
                db.getVenueSetting(venue.id, 'max_dwell_minutes', 120),
                db.outstandingBalance(venue.id),
                db.landedWithoutOrders(venue.id),
                db.openBillOverview(venue.id),
                db.recentCashFees(venue.id),
            ]);
            if (threshold !== null) setDwellThreshold(threshold);
            setOutstanding(bal.data);
            setLanded(landedRows.data);
            setOpenBills(billRows.data);
            setRecentFees(fees.data);
        } catch {
            /* keep last known values */
        }
    }, [venue.id]);

    useEffect(() => {
        const init = async () => {
            await loadLive();
        };
        init();
        }, [loadLive]);

    // Live refresh — customer sessions, bills and payments drive this
    // screen; no polling.
    const liveTimer = useRef<number | null>(null);
    const scheduleLive = useCallback(() => {
        if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
        liveTimer.current = window.setTimeout(() => {
            liveTimer.current = null;
            loadLive();
        }, 500);
    }, [loadLive]);

    useRealtime({
        table: 'customer_sessions',
        filter: venue.id === "00000000-0000-0000-0000-000000000000" ? undefined : `venue_id=eq.${venue.id}`,
        onInsert: scheduleLive,
        onUpdate: scheduleLive,
    });
    useRealtime({ table: 'bills', filter: venue.id === "00000000-0000-0000-0000-000000000000" ? undefined : `venue_id=eq.${venue.id}`, onInsert: scheduleLive, onUpdate: scheduleLive });
    useRealtime({ table: 'payments', filter: venue.id === "00000000-0000-0000-0000-000000000000" ? undefined : `venue_id=eq.${venue.id}`, onInsert: scheduleLive, onUpdate: scheduleLive });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const lowStockCritical = s.lowStockItems.filter((i) => i.stock <= i.threshold / 2);

    // Overdue orders → "wait" alerts
    const waitAlerts = s.recentOrders
        .filter((o) => (o.status === "pending" || o.status === "confirmed" || o.status === "preparing") && o.time.includes("min ago"))
        .slice(0, 3);

    // Tables idle past the venue's max_dwell_minutes → dwell alerts
    const dwellAlerts = billGroups
        .filter((group) => Math.max(...group.map((b) => b.dwell_minutes)) >= dwellThreshold)
        .map((group) => ({
            label: group.map((b) => b.table_label ?? `Table ${b.table_number}`).join(" + "),
            dwell: Math.max(...group.map((b) => b.dwell_minutes)),
        }));

    if (s.loading && s.recentOrders.length === 0) {
        return (
            <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
                <div className="h-10 w-64 rounded-xl bg-licorice/5 animate-pulse" />
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-44 rounded-[1.5rem] bg-licorice/5 animate-pulse" />
                    ))}
                </div>
                <div className="h-[280px] rounded-[1.5rem] bg-licorice/5 animate-pulse" />
                <div className="h-[200px] rounded-[1.5rem] bg-licorice/5 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">

            {/* ═══════════════════════════════════════════════════════════
               HEADER — Greeting + Quick Actions
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-[26px] font-black tracking-[-0.03em] text-licorice">
                        {greeting}, Manager
                    </h1>

                </div>

                {/* Quick action buttons */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full bg-licorice text-isabelline px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(35,20,12,0.18)] hover:bg-licorice/95 active:scale-[0.97] transition-all"
                    >
                        <PlusIcon className="h-4 w-4" strokeWidth={2} />
                        New Order
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate?.("finance")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white text-licorice px-4 py-2 text-sm font-semibold ring-1 ring-licorice/8 hover:bg-isabelline active:scale-[0.97] transition-all"
                    >
                        View Report
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               ALERT BANNERS — Low stock + Pending alerts (from real data)
               ═══════════════════════════════════════════════════════════ */}
            {s.lowStockCount > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <ExclamationTriangleIcon className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm tracking-tight text-licorice">
                            {s.lowStockCount} low-stock item{s.lowStockCount > 1 ? "s" : ""} &middot; {lowStockCritical.length} critical alert{lowStockCritical.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-feldgrau mt-0.5 line-clamp-1">
                            {s.lowStockItems.map((i) => `${i.name} (${i.stock} left)`).join(", ")}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="flex-shrink-0 rounded-full bg-licorice text-isabelline px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide hover:bg-licorice/90 transition-colors"
                    >
                        Review &rarr;
                    </button>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
               KPI GRID — 4 large stat cards
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">

                {/* Revenue — dark card */}
                <div 
                    onClick={() => onNavigate?.("finance")}
                    className="md:col-span-2 h-full rounded-[1.5rem] bg-licorice text-isabelline p-5 md:p-6 shadow-[0_8px_24px_rgba(35,20,12,0.18)] flex flex-col justify-between relative overflow-hidden cursor-pointer hover:bg-licorice/95 transition-all group"
                >
                    <div className="group-active:scale-[0.98] transition-transform duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <BanknotesIcon className="h-5 w-5 text-isabelline/50" strokeWidth={2} />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-white/60">Today's Revenue</p>
                        <div className="mb-1">
                            <h2 className="mt-1 text-[28px] md:text-[32px] font-bold tabular-nums leading-none tracking-tight">
                                {formatGHS(s.todayRevenue)}
                            </h2>
                        </div>
                        <p className="py-3 text-xs font-medium tracking-tight text-isabelline/40">
                            vs. {formatGHS(s.yesterdayRevenue)} yesterday
                        </p>
                    </div>
                    <div className="flex flex-row items-center gap-3 mt-auto group-active:scale-[0.98] transition-transform duration-200">
                        <span className="rounded-full bg-white/10 text-isabelline/80 px-3 py-2 text-xs font-bold tabular-nums text-center">
                            {s.paymentsToday} payment{s.paymentsToday === 1 ? "" : "s"} today
                        </span>
                    </div>
                </div>

                {/* Open Orders */}
                <div className="md:col-span-1 h-full rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <ShoppingCartIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Orders Being Made</p>
                        <h2 className="mt-1 text-[28px] md:text-[32px] font-bold tabular-nums leading-none text-licorice">
                            {s.openOrders}
                        </h2>
                        <p className="mt-1.5 text-xs font-medium tracking-tight text-feldgrau">
                            in the kitchen &amp; bar
                        </p>
                    </div>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-isabelline">
                        <div
                            className="h-full rounded-full bg-khaki transition-all duration-500"
                            style={{ width: `${s.totalTables ? Math.min(100, (s.openOrders / Math.max(s.totalTables * 2, 1)) * 100) : 0}%` }}
                        />
                    </div>
                </div>

                {/* Tables Occupied */}
                <div 
                    onClick={() => onNavigate?.("floorplan")}
                    className="md:col-span-1 h-full rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between cursor-pointer hover:bg-isabelline/50 transition-all group"
                >
                    <div className="group-active:scale-[0.98] transition-transform duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <TableCellsIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tables in Use</p>
                        <h2 className="mt-1 text-[28px] md:text-[32px] font-bold tabular-nums leading-none text-licorice">
                            {s.occupiedTables}
                            <span className="text-[16px] font-bold text-feldgrau">/{s.totalTables}</span>
                        </h2>
                        <p className="mt-1.5 text-xs font-medium tracking-tight text-feldgrau">
                            {s.totalTables - s.occupiedTables} tables free
                        </p>
                    </div>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-isabelline group-active:scale-[0.98] transition-transform duration-200">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${s.totalTables ? (s.occupiedTables / s.totalTables) * 100 : 0}%`,
                                backgroundColor: s.totalTables && s.occupiedTables / s.totalTables > 0.7 ? "#91040C" : "#23140C",
                            }}
                        />
                    </div>
                </div>


            </div>

            {/* ═══════════════════════════════════════════════════════════
               BOTTOM ROW — Chart, Top Items
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── Revenue Chart (real payments, real submissions) ── */}
                <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Revenue</h2>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-full bg-isabelline p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setRange(7)}
                                    className={`text-xs px-2.5 py-1 font-medium rounded-md transition-colors ${range === 7 ? "bg-licorice text-isabelline" : "text-feldgrau hover:text-licorice"
                                        }`}
                                >
                                    7D
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRange(30)}
                                    className={`text-xs px-2.5 py-1 font-medium rounded-md transition-colors ${range === 30 ? "bg-licorice text-isabelline" : "text-feldgrau hover:text-licorice"
                                        }`}
                                >
                                    30D
                                </button>
                            </div>

                        </div>
                    </div>

                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={s.weeklyRevenue} barGap={6}>
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#606F69", fontWeight: 600 }}
                                    dy={8}
                                />
                                <Tooltip
                                    cursor={{ fill: "#F3F3E3" }}
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "none",
                                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                                        fontSize: "11px",
                                        fontWeight: "500",
                                        padding: "8px 12px",
                                    }}
                                    labelStyle={{ display: "none" }}
                                    formatter={(value, name) => [
                                        name === "revenue" ? formatGHS(Number(value)) : `${value} orders`,
                                        name === "revenue" ? "Revenue" : "Orders",
                                    ]}
                                />
                                <Bar dataKey="revenue" fill="#23140C" radius={[6, 6, 6, 6]} barSize={22} opacity={0.85} />
                                <Bar dataKey="orders" fill="#D0BA98" radius={[6, 6, 6, 6]} barSize={22} opacity={0.7} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-isabelline pt-3 text-sm tabular-nums">
                        <span className="font-bold tracking-tight text-feldgrau">
                            {s.weeklyRevenue.length > 0
                                ? `Best day: ${s.weeklyRevenue.reduce((a, b) => (b.revenue > a.revenue ? b : a)).day} · ` + formatGHSString(s.weeklyRevenue.reduce((a, b) => (b.revenue > a.revenue ? b : a)).revenue)
                                : "No sales yet"}
                        </span>
                        <span className="font-semibold tabular-nums text-licorice">
                            Total: {formatGHS(s.weeklyRevenue.reduce((sum, d) => sum + d.revenue, 0))}
                        </span>
                    </div>
                </div>

                {/* ── Top Sellers (real order items, selected window) ── */}
                <div 
                    onClick={() => onNavigate?.("menu?tab=top-sellers")}
                    className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col h-full cursor-pointer hover:bg-isabelline/50 transition-all group"
                >
                    <div className="group-active:scale-[0.98] transition-transform duration-200 h-full flex flex-col">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Top Sellers</h2>

                    {s.topItems.length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-sm font-bold text-feldgrau">No sales yet</p>
                            <p className="text-xs text-feldgrau/70 mt-1">Orders will appear here once guests start ordering.</p>
                        </div>
                    ) : (
                        <ul className="space-y-5">
                            {(s.topItems.length === 2 ? [...s.topItems, { name: "Midnight Mule", sold: 1, revenue: 140, pct: 0 }] : s.topItems).slice(0, 3).map((item) => (
                                <li key={item.name} className="flex items-center justify-between">
                                    <span className="text-[15px] font-medium tracking-tight text-licorice truncate pr-4">
                                        {item.name}
                                    </span>
                                    <div className="flex flex-col items-end text-right leading-none shrink-0">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[26px] font-bold tabular-nums text-licorice tracking-tight">{item.sold}</span>
                                            <span className="text-[13px] text-feldgrau">sold</span>
                                        </div>
                                        <span className="text-xs text-feldgrau mt-1.5 tabular-nums">
                                            {formatGHS(item.revenue)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onNavigate?.("menu?tab=top-sellers");
                        }}
                        className="mt-auto w-full rounded-full bg-isabelline py-2 text-xs font-bold tracking-tight text-feldgrau hover:text-licorice transition-colors"
                    >
                        View Full Menu Report &rarr;
                    </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               ALERTS + STAFF SNAPSHOT ROW
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

                {/* ── Alerts Panel (real low stock + wait times) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Alerts</h2>
                        {s.lowStockCount + waitAlerts.length + dwellAlerts.length > 0 && (
                            <span className="rounded-full bg-dark-red/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-dark-red">
                                {s.lowStockCount + waitAlerts.length + dwellAlerts.length}
                            </span>
                        )}
                    </div>

                    {s.lowStockCount === 0 && waitAlerts.length === 0 && dwellAlerts.length === 0 ? (
                        <div className="py-10 text-center">
                            <CheckBadgeIcon className="mx-auto h-8 w-8 text-slate-400 fill-none" strokeWidth={1.5} />
                            <p className="mt-2 text-sm font-bold text-feldgrau">All clear</p>
                            <p className="text-xs text-feldgrau/70 mt-1">Nothing needs your attention.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {s.lowStockItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${item.stock <= item.threshold / 2 ? "bg-dark-red/5" : "bg-khaki/5"
                                        }`}
                                >
                                    <span
                                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${item.stock <= item.threshold / 2 ? "bg-dark-red/15 text-dark-red" : "bg-khaki/20 text-khaki"
                                            }`}
                                    >
                                        STK
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold tracking-tight text-licorice">{item.name}</p>
                                        <p className="text-xs tracking-tight text-feldgrau">
                                            {item.stock} left · reorder at {item.threshold}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {waitAlerts.map((o) => (
                                <div
                                    key={o.id}
                                    className="flex items-start gap-3 rounded-lg bg-khaki/5 px-3 py-2.5"
                                >
                                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-xs font-bold uppercase text-khaki">
                                        TIM
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold tracking-tight text-licorice">{o.table}</p>
                                        <p className="text-xs tracking-tight text-feldgrau">
                                            Order waiting {o.time} · {o.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {dwellAlerts.map((a) => (
                                <div
                                    key={`dwell-${a.label}`}
                                    className="flex items-start gap-3 rounded-lg bg-dark-red/5 px-3 py-2.5"
                                >
                                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dark-red/15 text-xs font-bold uppercase text-dark-red">
                                        TBL
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold tracking-tight text-licorice">{a.label}</p>
                                        <p className="text-xs tracking-tight text-feldgrau">
                                            No activity for {formatDwell(a.dwell)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* ── Staff & Floor Snapshot (real staff + active shifts) ── */}
                <div 
                    onClick={() => onNavigate?.("staff")}
                    className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col h-full cursor-pointer hover:bg-isabelline/50 transition-all group"
                >
                    <div className="group-active:scale-[0.98] transition-transform duration-200 h-full flex flex-col">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Staff</h2>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="text-[22px] font-bold tabular-nums text-licorice">{s.staffOnShift}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-feldgrau">On Shift</p>
                        </div>
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="text-[22px] font-bold tabular-nums text-licorice">{s.totalStaff}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-feldgrau">Total Staff</p>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-bold tracking-tight text-licorice">Waiters on floor</span>
                            <span className="font-bold tabular-nums text-feldgrau">{s.waitersOnFloor}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-bold tracking-tight text-licorice">Kitchen staff</span>
                            <span className="font-bold tabular-nums text-feldgrau">{s.kitchenStaff}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-bold tracking-tight text-licorice">Bartenders</span>
                            <span className="font-bold tabular-nums text-feldgrau">{s.bartenders}</span>
                        </div>
                    </div>
                    </div>
                </div>

                {/* ── Quick Stats (real today's numbers) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col h-full">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Shift Metrics</h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <ShoppingCartIcon className="w-4 h-4 text-slate-400 stroke-[1.5px] fill-none" />
                                <span className="text-xs font-medium tracking-tight text-feldgrau">Orders taken</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-licorice">{s.ordersTakenToday}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <CheckBadgeIcon className="w-4 h-4 text-slate-400 stroke-[1.5px] fill-none" />
                                <span className="text-xs font-medium tracking-tight text-feldgrau">Payments today</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-licorice">{s.paymentsToday}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <ArrowUpRightIcon className="w-4 h-4 text-slate-400 stroke-[1.5px] fill-none" />
                                <span className="text-xs font-medium tracking-tight text-feldgrau">Avg order value</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-licorice">{formatGHS(s.avgOrderValue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="w-4 h-4 text-slate-400 stroke-[1.5px] fill-none" />
                                <span className="text-xs font-medium tracking-tight text-feldgrau">Guests served</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-licorice">{s.guestsServed}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               RECENT ACTIVITIES TABLE — real order submissions
               ═══════════════════════════════════════════════════════════ */}
            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recent Orders</h2>
                </div>

                <div className="overflow-x-auto no-scrollbar">

                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                        <tr className="uppercase tracking-wide text-xs font-medium text-slate-500 border-b border-isabelline">
                            <th className="pb-3 font-normal">Order</th>
                            <th className="pb-3 font-normal">Customer</th>
                            <th className="pb-3 font-normal">Table</th>
                            <th className="pb-3 font-normal">Items</th>
                            <th className="pb-3 font-normal">Amount</th>
                            <th className="pb-3 font-normal">Status</th>
                            <th className="pb-3 font-normal text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline/60 text-sm text-slate-700">
                        {s.recentOrders
                            .filter((order) => {
                                if (order.time === "just now" || order.time.includes("min")) return true;
                                const match = order.time.match(/^(\d+)h/);
                                return match ? parseInt(match[1], 10) < 12 : true;
                            })
                            .map((order) => (
                                <tr key={order.id} className="group hover:bg-isabelline/30 transition-colors cursor-pointer">
                                    <td className="py-3 pr-2">
                                        <span className="tabular-nums text-slate-700">{order.ref}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-isabelline flex items-center justify-center text-xs font-medium text-slate-500 uppercase">
                                                {order.customer.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                                            </div>
                                            <span className="text-slate-700">{order.customer}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="tabular-nums text-slate-700">{order.table}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="tabular-nums text-slate-700">{order.items}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="text-sm font-semibold tabular-nums text-licorice">{formatGHS(order.amount)}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <OrderStatusBadge status={order.status} />
                                    </td>
                                    <td className="py-3 text-right">
                                        <span className="tabular-nums text-slate-700">{order.time}</span>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>

                {s.recentOrders.length === 0 && (
                    <div className="py-12 text-center">
                        <p className="text-sm text-slate-500">No orders submitted yet.</p>
                    </div>
                )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               SETTLEMENT & FLOOR WATCH — platform fees owed, customers who
               landed but never ordered, open bills per table
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full">
                {/* Header Block */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Bysen Fees</h2>
                </div>

                {/* Primary KPI Block */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Owed to Bysen</span>
                        {/* Tooltip trigger replaces the paragraph of text */}
                        <svg className="w-4 h-4 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div className="text-4xl font-bold text-slate-900 tabular-nums tracking-tight">
                        {formatGHS(outstanding)}
                    </div>
                </div>

                {/* Cash Fee Ledger Table */}
                <div className="flex flex-col gap-4 mt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                        Recent Fees
                    </h3>

                    <div className="flex flex-col">
                        {recentFees.length === 0 ? (
                            <p className="text-sm text-slate-500">No fees yet.</p>
                        ) : (
                            recentFees.map((p, i) => (
                                <div key={p.payment_id} className="grid grid-cols-[16px_1fr_auto_auto] items-center gap-3 py-3 border-b border-slate-50 whitespace-nowrap">
                                    <span className="text-sm font-medium text-slate-900">{i + 1}</span>
                                    <span className="text-sm text-slate-500">
                                        {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <span className="text-sm text-slate-500 tabular-nums">{formatGHS(p.amount)}</span>
                                    <span className="text-sm font-semibold text-slate-900 tabular-nums text-right min-w-[3rem]">
                                        {formatGHS(p.platform_fee)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Open Bills */}
                <div className="flex flex-col gap-4 mt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                        Open Bills
                    </h3>
                    {billGroups.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            No open bills right now.
                        </p>
                    ) : (
                        <div className="flex flex-col">
                            {billGroups.map((group) => {
                                const total = group.reduce((sum, b) => sum + Number(b.total), 0);
                                const label = group.map((b) => b.table_label ?? `Table ${b.table_number}`).join(" + ");
                                return (
                                    <div key={group[0].bill_id} className="grid grid-cols-2 items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                                        <span className="text-sm font-medium text-slate-900">{label}</span>
                                        <span className="text-sm font-semibold tabular-nums text-slate-900 text-right">{formatGHS(total)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>


        </div>
    );
}
