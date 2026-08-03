import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "../../hooks/useRealtime";
import {
    ArrowTrendingUpIcon,
    ArrowUpRightIcon,
    BanknotesIcon,
    ChartBarIcon,
    CheckBadgeIcon,
    ChevronRightIcon,
    ClockIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    LinkIcon,
    PlusIcon,
    ShoppingCartIcon,
    TableCellsIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGHS } from "../../data/menu";
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
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className={s.text}>{s.label}</span>
        </span>
    );
}

function formatCompact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

function formatGHSCompact(n: number): string {
    if (n >= 1000) return `₵${(n / 1000).toFixed(1)}k`;
    return formatGHS(n);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function LiveOpsScreen() {
    const { venue } = useVenue('velvet-lounge');
    const [range, setRange] = useState<7 | 30>(7);
    const s = useManagerDashboard(venue.id, range);

    const [outstanding, setOutstanding] = useState(0);
    const [landed, setLanded] = useState<Awaited<ReturnType<typeof db.landedWithoutOrders>>["data"]>([]);
    const [openBills, setOpenBills] = useState<Awaited<ReturnType<typeof db.openBillOverview>>["data"]>([]);

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
        try {
            const [bal, landedRows, billRows] = await Promise.all([
                db.outstandingBalance(venue.id),
                db.landedWithoutOrders(venue.id),
                db.openBillOverview(venue.id),
            ]);
            setOutstanding(bal.data);
            setLanded(landedRows.data);
            setOpenBills(billRows.data);
        } catch {
            /* keep last known values */
        }
    }, [venue.id]);

    useEffect(() => {
        loadLive();
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
        filter: `venue_id=eq.${venue.id}`,
        onInsert: scheduleLive,
        onUpdate: scheduleLive,
    });
    useRealtime({ table: 'bills', filter: `venue_id=eq.${venue.id}`, onInsert: scheduleLive, onUpdate: scheduleLive });
    useRealtime({ table: 'payments', filter: `venue_id=eq.${venue.id}`, onInsert: scheduleLive, onUpdate: scheduleLive });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const lowStockCritical = s.lowStockItems.filter((i) => i.stock <= i.threshold / 2);

    // Overdue orders → "wait" alerts
    const waitAlerts = s.recentOrders
        .filter((o) => (o.status === "pending" || o.status === "confirmed" || o.status === "preparing") && o.time.includes("min ago"))
        .slice(0, 3);

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
                    <p className="text-[12px] text-feldgrau mt-0.5">
                        {new Date().toLocaleDateString("en-GH", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                        })}
                        {" · "}
                        <span className="font-mono font-bold tabular-nums">
                            {new Date().toLocaleTimeString("en-GH", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                            })}
                        </span>
                        {s.lastUpdated && (
                            <span className="hidden sm:inline text-feldgrau/60">
                                {" · updated "}
                                {s.lastUpdated.toLocaleTimeString("en-GH", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                })}
                            </span>
                        )}
                    </p>
                </div>

                {/* Quick action buttons */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full bg-licorice text-isabelline px-4 py-2 text-[11px] font-bold tracking-tight shadow-[0_4px_12px_rgba(35,20,12,0.18)] hover:bg-licorice/95 active:scale-[0.97] transition-all"
                    >
                        <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        New Order
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white text-licorice px-4 py-2 text-[11px] font-bold tracking-tight ring-1 ring-licorice/8 hover:bg-isabelline active:scale-[0.97] transition-all"
                    >
                        <ChartBarIcon className="h-3.5 w-3.5" strokeWidth={2} />
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
                        <p className="font-bold text-[13px] tracking-tight text-licorice">
                            {s.lowStockCount} low-stock item{s.lowStockCount > 1 ? "s" : ""} &middot; {lowStockCritical.length} critical alert{lowStockCritical.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-[11px] text-feldgrau mt-0.5 line-clamp-1">
                            {s.lowStockItems.map((i) => `${i.name} (${i.stock} left)`).join(", ")}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="flex-shrink-0 rounded-full bg-licorice text-isabelline px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] hover:bg-licorice/90 transition-colors"
                    >
                        Review &rarr;
                    </button>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
               KPI GRID — 4 large stat cards
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

                {/* Revenue — dark card */}
                <div className="rounded-[1.5rem] bg-licorice text-isabelline p-5 md:p-6 shadow-[0_8px_24px_rgba(35,20,12,0.18)] flex flex-col justify-between relative overflow-hidden">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <BanknotesIcon className="h-5 w-5 text-isabelline/50" strokeWidth={2} />
                            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.revenueTrend >= 0 ? "bg-khaki/20 text-khaki" : "bg-dark-red/30 text-red-300"}`}>
                                <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                {s.revenueTrend >= 0 ? "+" : ""}{s.revenueTrend.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/50">Today's Revenue</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none tracking-tight">
                            {formatGHS(s.todayRevenue)}
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-isabelline/40">
                            vs. {formatGHS(s.yesterdayRevenue)} yesterday
                        </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="flex-1 rounded-full bg-white/10 text-isabelline/80 px-3 py-2 text-[10px] font-bold text-center">
                            {s.paymentsToday} payment{s.paymentsToday === 1 ? "" : "s"} today
                        </span>
                        <span className="flex-1 rounded-full bg-white/10 text-isabelline/80 px-3 py-2 text-[10px] font-bold text-center">
                            {formatGHSCompact(s.todayRevenue)} collected
                        </span>
                    </div>
                </div>

                {/* Open Orders */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <ShoppingCartIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                            <span className="inline-flex items-center gap-1 rounded-full bg-khaki/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-khaki" />
                                Live
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Open Orders</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none text-licorice">
                            {s.openOrders}
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            across kitchen &middot; bar
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
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <TableCellsIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                            <span className="inline-flex items-center gap-1 rounded-full bg-feldgrau/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                {s.totalTables ? Math.round((s.occupiedTables / s.totalTables) * 100) : 0}%
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Tables Occupied</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none text-licorice">
                            {s.occupiedTables}
                            <span className="text-[16px] font-bold text-feldgrau">/{s.totalTables}</span>
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            {s.totalTables - s.occupiedTables} tables free
                        </p>
                    </div>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-isabelline">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${s.totalTables ? (s.occupiedTables / s.totalTables) * 100 : 0}%`,
                                backgroundColor: s.totalTables && s.occupiedTables / s.totalTables > 0.7 ? "#91040C" : "#23140C",
                            }}
                        />
                    </div>
                </div>

                {/* Avg Wait Time */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <ClockIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.avgWait > 15 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                                <CheckBadgeIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                {s.avgWait > 15 ? "Slow" : "Healthy"}
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg Wait Time</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none text-licorice">
                            {Math.round(s.avgWait)}
                            <span className="text-[16px] font-bold text-feldgrau">m</span>
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            {"target < 15m"}
                        </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-bold">
                        <span className={`flex items-center gap-1 ${s.avgWait > 15 ? "text-amber-600" : "text-emerald-600"}`}>
                            <CheckBadgeIcon className="h-3 w-3" strokeWidth={2.5} />
                            {s.avgWait > 15 ? "Needs attention" : "On track"}
                        </span>
                        <span className="text-feldgrau/50">&middot;</span>
                        <span className="text-feldgrau">{s.openOrders} open</span>
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
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Revenue</p>
                            <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">
                                Last {range} days
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-full bg-isabelline p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setRange(7)}
                                    className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                        range === 7 ? "bg-licorice text-isabelline" : "text-feldgrau hover:text-licorice"
                                    }`}
                                >
                                    7D
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRange(30)}
                                    className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                        range === 30 ? "bg-licorice text-isabelline" : "text-feldgrau hover:text-licorice"
                                    }`}
                                >
                                    30D
                                </button>
                            </div>
                            <div className="hidden sm:flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-sm bg-licorice/80" />
                                    Daily Revenue
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-sm bg-khaki" />
                                    Orders
                                </span>
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

                    <div className="mt-4 flex items-center justify-between border-t border-isabelline pt-3 text-[11px]">
                        <span className="font-bold tracking-tight text-feldgrau">
                            {s.weeklyRevenue.length > 0
                                ? `Best day: ${s.weeklyRevenue.reduce((a, b) => (b.revenue > a.revenue ? b : a)).day} · ${formatGHS(s.weeklyRevenue.reduce((a, b) => (b.revenue > a.revenue ? b : a)).revenue)}`
                                : "No sales yet"}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-licorice">
                            Total: {formatGHS(s.weeklyRevenue.reduce((sum, d) => sum + d.revenue, 0))}
                        </span>
                    </div>
                </div>

                {/* ── Top Sellers (real order items, selected window) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Top Sellers</p>
                        <ChartBarIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">By revenue</h3>

                    {s.topItems.length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-[12px] font-bold text-feldgrau">No sales yet</p>
                            <p className="text-[10.5px] text-feldgrau/70 mt-1">Orders will appear here once guests start ordering.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {s.topItems.map((item, idx) => (
                                <li key={item.name}>
                                    <div className="flex items-center justify-between text-[11.5px]">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="font-mono text-[10px] font-bold tabular-nums text-feldgrau shrink-0">
                                                {String(idx + 1).padStart(2, "0")}
                                            </span>
                                            <span className="truncate font-bold tracking-tight text-licorice">{item.name}</span>
                                        </span>
                                        <span className="shrink-0 font-mono font-bold tabular-nums text-licorice">
                                            {formatGHS(item.revenue)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isabelline">
                                            <div
                                                className="h-full rounded-full bg-khaki transition-all duration-500"
                                                style={{ width: `${item.pct}%` }}
                                            />
                                        </div>
                                        <span className="shrink-0 text-[9px] font-bold tabular-nums text-feldgrau">
                                            {item.sold} sold
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <button
                        type="button"
                        className="mt-4 w-full rounded-full bg-isabelline py-2 text-[10px] font-bold tracking-tight text-feldgrau hover:text-licorice transition-colors"
                    >
                        View Full Menu Report &rarr;
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               ALERTS + STAFF SNAPSHOT ROW
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── Alerts Panel (real low stock + wait times) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-dark-red" strokeWidth={2} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-red">Alerts</p>
                        </div>
                        <span className="rounded-full bg-dark-red/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dark-red">
                            {s.lowStockCount + waitAlerts.length}
                        </span>
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">Needs attention</h3>

                    {s.lowStockCount === 0 && waitAlerts.length === 0 ? (
                        <div className="py-10 text-center">
                            <CheckBadgeIcon className="mx-auto h-8 w-8 text-emerald-500" strokeWidth={1.5} />
                            <p className="mt-2 text-[12px] font-bold text-feldgrau">All clear</p>
                            <p className="text-[10.5px] text-feldgrau/70 mt-1">No stock or wait-time issues.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {s.lowStockItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-start gap-3 rounded-xl border-l-2 px-3 py-2.5 ${
                                        item.stock <= item.threshold / 2 ? "border-dark-red bg-dark-red/5" : "border-khaki bg-khaki/5"
                                    }`}
                                >
                                    <span
                                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase ${
                                            item.stock <= item.threshold / 2 ? "bg-dark-red/15 text-dark-red" : "bg-khaki/20 text-khaki"
                                        }`}
                                    >
                                        STK
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                        <p className="text-[10.5px] tracking-tight text-feldgrau">
                                            {item.stock} left · reorder at {item.threshold}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {waitAlerts.map((o) => (
                                <div
                                    key={o.id}
                                    className="flex items-start gap-3 rounded-xl border-l-2 border-khaki bg-khaki/5 px-3 py-2.5"
                                >
                                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-[9px] font-bold uppercase text-khaki">
                                        TIM
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-bold tracking-tight text-licorice">{o.table}</p>
                                        <p className="text-[10.5px] tracking-tight text-feldgrau">
                                            Order waiting {o.time} · {o.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        className="mt-4 w-full rounded-full bg-isabelline py-2 text-[10px] font-bold tracking-tight text-feldgrau hover:text-licorice transition-colors"
                    >
                        View All Alerts &rarr;
                    </button>
                </div>

                {/* ── Staff & Floor Snapshot (real staff + active shifts) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Staff</p>
                        <UserGroupIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">On duty now</h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="font-mono text-[22px] font-black tabular-nums text-licorice">{s.staffOnShift}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">On Shift</p>
                        </div>
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="font-mono text-[22px] font-black tabular-nums text-licorice">{s.totalStaff}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Total Staff</p>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Waiters on floor</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">{s.waitersOnFloor}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Kitchen staff</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">{s.kitchenStaff}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Bartenders</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">{s.bartenders}</span>
                        </div>
                    </div>

                    <div className={`mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 ${s.staffOnShift === 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                        <CheckBadgeIcon className={`h-3.5 w-3.5 shrink-0 ${s.staffOnShift === 0 ? "text-amber-600" : "text-emerald-600"}`} strokeWidth={2.5} />
                        <span className={`text-[10px] font-bold tracking-tight ${s.staffOnShift === 0 ? "text-amber-700" : "text-emerald-700"}`}>
                            {s.staffOnShift === 0 ? "No active shifts yet" : "All stations covered"}
                        </span>
                    </div>
                </div>

                {/* ── Quick Stats (real today's numbers) ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Today's Numbers</p>
                        <CubeIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">At a glance</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <ShoppingCartIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Orders taken</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">{s.ordersTakenToday}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <CheckBadgeIcon className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Payments today</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">{s.paymentsToday}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <ArrowUpRightIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Avg order value</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">{formatGHS(s.avgOrderValue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Guests served</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">{s.guestsServed}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               RECENT ACTIVITIES TABLE — real order submissions
               ═══════════════════════════════════════════════════════════ */}
            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 overflow-x-auto no-scrollbar">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Activity</p>
                        <h3 className="text-[16px] font-bold tracking-tight text-licorice">Recent Orders</h3>
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold tracking-tight text-feldgrau hover:text-licorice transition-colors"
                    >
                        View All
                        <ChevronRightIcon className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                </div>

                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                        <tr className="uppercase tracking-widest text-[9px] font-bold text-feldgrau border-b border-isabelline">
                            <th className="pb-3 font-normal">Order</th>
                            <th className="pb-3 font-normal">Customer</th>
                            <th className="pb-3 font-normal">Table</th>
                            <th className="pb-3 font-normal">Items</th>
                            <th className="pb-3 font-normal">Amount</th>
                            <th className="pb-3 font-normal">Status</th>
                            <th className="pb-3 font-normal text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline/60">
                        {s.recentOrders.map((order) => (
                            <tr key={order.id} className="group hover:bg-isabelline/30 transition-colors cursor-pointer">
                                <td className="py-3 pr-2">
                                    <span className="font-bold text-[11px] text-feldgrau">{order.ref}</span>
                                </td>
                                <td className="py-3 pr-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-isabelline flex items-center justify-center text-[9px] font-bold text-feldgrau uppercase">
                                            {order.customer.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                                        </div>
                                        <span className="font-semibold text-[11.5px] text-licorice">{order.customer}</span>
                                    </div>
                                </td>
                                <td className="py-3 pr-2">
                                    <span className="font-mono text-[11px] font-bold text-feldgrau">{order.table}</span>
                                </td>
                                <td className="py-3 pr-2">
                                    <span className="font-mono text-[11px] font-medium text-feldgrau">{order.items}</span>
                                </td>
                                <td className="py-3 pr-2">
                                    <span className="font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(order.amount)}</span>
                                </td>
                                <td className="py-3 pr-2">
                                    <OrderStatusBadge status={order.status} />
                                </td>
                                <td className="py-3 text-right">
                                    <span className="text-[10.5px] font-medium text-feldgrau">{order.time}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {s.recentOrders.length === 0 && (
                    <div className="text-center py-12 text-feldgrau text-xs">
                        No orders yet — share the table QR codes and orders will show up here live.
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
               SETTLEMENT & FLOOR WATCH — platform fees owed, customers who
               landed but never ordered, open bills per table
               ═══════════════════════════════════════════════════════════ */}
            <div className="rounded-[1.5rem] bg-white ring-1 ring-licorice/5 shadow-[0_4px_16px_rgba(35,20,12,0.05)] p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Cash settlements</p>
                        <h3 className="text-[16px] font-bold tracking-tight text-licorice">Outstanding Platform Fees</h3>
                    </div>
                    <span className="rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-700 px-3 py-1 text-[10px] font-bold">
                        Invoice monthly
                    </span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl bg-licorice p-5 text-isabelline flex flex-col justify-between">
                        <div className="flex items-center gap-2">
                            <BanknotesIcon className="h-4 w-4 text-amber-300" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/70">
                                Owed to Bysen
                            </span>
                        </div>
                        <p className="mt-2 font-mono text-[30px] font-black tabular-nums tracking-tight">
                            {formatGHS(outstanding)}
                        </p>
                        <p className="text-[10.5px] text-isabelline/60 leading-snug mt-1">
                            1% fee on cash payments (min ₵1, max ₵15). Online fees are auto-deducted by the payment
                            provider at each transaction.
                        </p>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-isabelline/60 p-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            Landed, never ordered <span className="ml-1 normal-case tracking-normal text-feldgrau/60">· auto-expires after 20 min</span>
                        </p>
                        <div className="mt-3 space-y-2">
                            {landed.length === 0 && (
                                <p className="text-[11.5px] text-feldgrau/70">All sessions ordered — nothing to chase.</p>
                            )}
                            {landed.slice(0, 6).map((row) => (
                                <div key={row.session_id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-licorice/5">
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono text-[11px] font-bold text-feldgrau">
                                            {row.table_label ?? `Table ${row.table_number}`}
                                        </span>
                                        <span className="text-[10px] text-feldgrau/60">
                                            scanned {row.age_minutes} min ago
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-bold ${row.age_minutes >= 15 ? "text-red-600" : "text-amber-600"}`}>
                                        {Math.max(0, 20 - row.age_minutes)} min left
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                        Open bills per table <span className="ml-1 normal-case tracking-normal text-feldgrau/60">· linked tables are counted together</span>
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {billGroups.length === 0 && (
                            <p className="text-[11.5px] text-feldgrau/70">No open bills right now.</p>
                        )}
                        {billGroups.map((group) => {
                            const total = group.reduce((sum, b) => sum + Number(b.total), 0);
                            const openFor = Math.max(...group.map((b) => b.age_minutes));
                            const label = group
                                .map((b) => b.table_label ?? `Table ${b.table_number}`)
                                .join(" + ");
                            return (
                                <div key={group[0].bill_id} className="flex items-center justify-between gap-3 rounded-xl bg-isabelline/60 px-3.5 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono text-[11px] font-bold text-feldgrau">{label}</span>
                                        {group.length > 1 && (
                                            <LinkIcon className="h-3.5 w-3.5 text-feldgrau/50" />
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                                            {formatGHS(total)}
                                        </p>
                                        <p className="text-[9.5px] text-feldgrau/60">
                                            {openFor} min open · {group.reduce((sum, b) => sum + b.guests, 0)}{" "}
                                            {group.reduce((sum, b) => sum + b.guests, 0) === 1 ? "guest" : "guests"}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               FOOTER STATUS BAR
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] bg-licorice px-5 py-3 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                <span className="text-[11px] font-bold tracking-tight">
                    Bysen &middot; {formatCompact(s.todayRevenue)} today &middot; {s.openOrders} open &middot; {s.occupiedTables}/{s.totalTables} tables
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-isabelline/60">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live · refreshes every 15s
                </span>
            </div>
        </div>
    );
}
