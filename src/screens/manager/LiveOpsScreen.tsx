import { useState } from "react";
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
    PlusIcon,
    ShoppingCartIcon,
    TableCellsIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGHS } from "../../data/menu";

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA — In production this would come from your API / Supabase
   ═══════════════════════════════════════════════════════════════════════════ */

type Alert = {
    id: string;
    type: "stock" | "wait" | "system";
    label: string;
    detail: string;
    severity: "warning" | "critical";
};

const ALERTS: Alert[] = [
    { id: "a1", type: "stock", label: "Cocoa Espresso Liqueur", detail: "2 bottles left · reorder threshold 5", severity: "critical" },
    { id: "a2", type: "stock", label: "Lamb Suya Skewers", detail: "8 portions left · reorder threshold 15", severity: "warning" },
    { id: "a3", type: "wait", label: "Table 06 · 22 min", detail: "Order pending for 22 minutes", severity: "critical" },
    { id: "a4", type: "wait", label: "Table 02 · 14 min", detail: "In preparation — bar queue", severity: "warning" },
];

/** 7-day daily revenue for the trend chart */
const WEEKLY_REVENUE = [
    { day: "Mon", revenue: 4200, orders: 28 },
    { day: "Tue", revenue: 3800, orders: 24 },
    { day: "Wed", revenue: 5100, orders: 34 },
    { day: "Thu", revenue: 4600, orders: 30 },
    { day: "Fri", revenue: 7800, orders: 52 },
    { day: "Sat", revenue: 9200, orders: 61 },
    { day: "Sun", revenue: 6400, orders: 43 },
];

const TOP_ITEMS = [
    { name: "Velvet Old Fashioned", sold: 42, revenue: 5460, pct: 100 },
    { name: "Lamb Suya Skewers", sold: 38, revenue: 3420, pct: 63 },
    { name: "Cocoa Espresso Martini", sold: 31, revenue: 3255, pct: 60 },
    { name: "Hibiscus Spritz", sold: 28, revenue: 2660, pct: 49 },
    { name: "Beef Tataki", sold: 22, revenue: 2420, pct: 44 },
];

type RecentOrder = {
    id: string;
    ref: string;
    customer: string;
    table: string;
    amount: number;
    status: "PENDING" | "PREPARING" | "SERVED" | "PAID" | "CANCELLED";
    time: string;
    items: number;
};

const RECENT_ORDERS: RecentOrder[] = [
    { id: "o1", ref: "#V-0428", customer: "Nana Kwame", table: "T-06", amount: 540, status: "PREPARING", time: "2 min ago", items: 3 },
    { id: "o2", ref: "#V-0427", customer: "Adwoa Asantewaa", table: "T-03", amount: 380, status: "SERVED", time: "8 min ago", items: 2 },
    { id: "o3", ref: "#V-0426", customer: "Kofi Asare", table: "T-08", amount: 720, status: "PAID", time: "15 min ago", items: 4 },
    { id: "o4", ref: "#V-0425", customer: "Ama Darko", table: "T-01", amount: 260, status: "PENDING", time: "22 min ago", items: 2 },
    { id: "o5", ref: "#V-0424", customer: "Kojo Frempong", table: "T-05", amount: 1100, status: "PAID", time: "31 min ago", items: 5 },
    { id: "o6", ref: "#V-0423", customer: "Esi Mensah", table: "T-02", amount: 195, status: "CANCELLED", time: "45 min ago", items: 1 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_STYLES: Record<RecentOrder["status"], { dot: string; text: string; label: string }> = {
    PENDING: { dot: "bg-amber-400", text: "text-amber-700", label: "Pending" },
    PREPARING: { dot: "bg-blue-400", text: "text-blue-700", label: "Preparing" },
    SERVED: { dot: "bg-indigo-400", text: "text-indigo-700", label: "Served" },
    PAID: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Paid" },
    CANCELLED: { dot: "bg-red-400", text: "text-red-700", label: "Cancelled" },
};

function OrderStatusBadge({ status }: { status: RecentOrder["status"] }) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function LiveOpsScreen() {
    const [timeframe] = useState<"today" | "week" | "month">("today");

    // ── Dynamic greeting ──
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    // ── Today's computed stats ──
    const todayRevenue = 7240;
    const yesterdayRevenue = 6100;
    const revenueTrend = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    const openOrders = 14;
    const occupiedTables = 6;
    const totalTables = 12;
    const avgWait = 8;
    const totalStaff = 6;
    const staffOnShift = 4;

    const lowStockCount = 3;

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
               ALERT BANNERS — Low stock + Pending alerts
               ═══════════════════════════════════════════════════════════ */}
            {lowStockCount > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <ExclamationTriangleIcon className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] tracking-tight text-licorice">
                            {lowStockCount} low-stock item{lowStockCount > 1 ? "s" : ""} &middot; {ALERTS.filter(a => a.severity === "critical").length} critical alert{ALERTS.filter(a => a.severity === "critical").length > 1 ? "s" : ""}
                        </p>
                        <p className="text-[11px] text-feldgrau mt-0.5">
                            {ALERTS.filter(a => a.severity === "critical").map(a => a.label).join(", ")}
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
               KPI GRID — 4 large stat cards like Vendly
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

                {/* Revenue — dark card like Vendly's */}
                <div className="rounded-[1.5rem] bg-licorice text-isabelline p-5 md:p-6 shadow-[0_8px_24px_rgba(35,20,12,0.18)] flex flex-col justify-between relative overflow-hidden">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <BanknotesIcon className="h-5 w-5 text-isabelline/50" strokeWidth={2} />
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-khaki/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">
                                <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                {revenueTrend > 0 ? "+" : ""}{revenueTrend.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/50">Today's Revenue</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none tracking-tight">
                            {formatGHS(todayRevenue)}
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-isabelline/40">
                            vs. {formatGHS(yesterdayRevenue)} yesterday
                        </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <button
                            type="button"
                            className="flex-1 rounded-full bg-white/10 text-isabelline/80 px-3 py-2 text-[10px] font-bold hover:bg-white/20 transition-colors"
                        >
                            {timeframe === "today" ? "Today" : timeframe === "week" ? "This Week" : "This Month"}
                        </button>
                        <button
                            type="button"
                            className="flex-1 rounded-full bg-white/10 text-isabelline/80 px-3 py-2 text-[10px] font-bold hover:bg-white/20 transition-colors"
                        >
                            View Details
                        </button>
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
                            {openOrders}
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            across kitchen &middot; bar
                        </p>
                    </div>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-isabelline">
                        <div className="h-full rounded-full bg-khaki" style={{ width: "58%" }} />
                    </div>
                </div>

                {/* Tables Occupied */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <TableCellsIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                            <span className="inline-flex items-center gap-1 rounded-full bg-feldgrau/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                {Math.round((occupiedTables / totalTables) * 100)}%
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Tables Occupied</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none text-licorice">
                            {occupiedTables}
                            <span className="text-[16px] font-bold text-feldgrau">/{totalTables}</span>
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            {totalTables - occupiedTables} tables free
                        </p>
                    </div>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-isabelline">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(occupiedTables / totalTables) * 100}%`,
                                backgroundColor: (occupiedTables / totalTables) > 0.7 ? "#91040C" : "#23140C",
                            }}
                        />
                    </div>
                </div>

                {/* Avg Wait Time */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <ClockIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                                <CheckBadgeIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                Healthy
                            </span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg Wait Time</p>
                        <h2 className="mt-1 font-mono text-[28px] md:text-[32px] font-black tabular-nums leading-none text-licorice">
                            {avgWait}
                            <span className="text-[16px] font-bold text-feldgrau">m</span>
                        </h2>
                        <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">
                            {"target < 15m"}
                        </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-bold">
                        <span className="flex items-center gap-1 text-emerald-600">
                            <CheckBadgeIcon className="h-3 w-3" strokeWidth={2.5} />
                            On track
                        </span>
                        <span className="text-feldgrau/50">&middot;</span>
                        <span className="text-feldgrau">Peak: 12m</span>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               BOTTOM ROW — 3 columns: Chart, Top Items, Alerts
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── 7-Day Revenue Chart (spans 2 cols on lg) ── */}
                <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Revenue</p>
                            <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Last 7 days</h3>
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

                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={WEEKLY_REVENUE} barGap={6}>
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
                                />
                                <Bar
                                    dataKey="revenue"
                                    fill="#23140C"
                                    radius={[6, 6, 6, 6]}
                                    barSize={22}
                                    opacity={0.85}
                                />
                                <Bar
                                    dataKey="orders"
                                    fill="#D0BA98"
                                    radius={[6, 6, 6, 6]}
                                    barSize={22}
                                    opacity={0.7}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-isabelline pt-3 text-[11px]">
                        <span className="font-bold tracking-tight text-feldgrau">
                            Best day: Sat &middot; {formatGHS(9200)}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-licorice">
                            Total: {formatGHS(WEEKLY_REVENUE.reduce((s, d) => s + d.revenue, 0))}
                        </span>
                    </div>
                </div>

                {/* ── Top Sellers ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Top Sellers</p>
                        <ChartBarIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">By revenue</h3>

                    <ul className="space-y-3">
                        {TOP_ITEMS.map((item, idx) => (
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

                {/* ── Alerts Panel ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-dark-red" strokeWidth={2} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-red">Alerts</p>
                        </div>
                        <span className="rounded-full bg-dark-red/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dark-red">
                            {ALERTS.length}
                        </span>
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">Needs attention</h3>

                    <div className="space-y-2">
                        {ALERTS.map((alert) => (
                            <div
                                key={alert.id}
                                className={`flex items-start gap-3 rounded-xl border-l-2 px-3 py-2.5 ${
                                    alert.severity === "critical"
                                        ? "border-dark-red bg-dark-red/5"
                                        : "border-khaki bg-khaki/5"
                                }`}
                            >
                                <span
                                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase ${
                                        alert.severity === "critical"
                                            ? "bg-dark-red/15 text-dark-red"
                                            : "bg-khaki/20 text-khaki"
                                    }`}
                                >
                                    {alert.type === "stock" ? "STK" : alert.type === "wait" ? "TIM" : "SYS"}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-bold tracking-tight text-licorice">{alert.label}</p>
                                    <p className="text-[10.5px] tracking-tight text-feldgrau">{alert.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="mt-4 w-full rounded-full bg-isabelline py-2 text-[10px] font-bold tracking-tight text-feldgrau hover:text-licorice transition-colors"
                    >
                        View All Alerts &rarr;
                    </button>
                </div>

                {/* ── Staff & Floor Snapshot ── */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Staff</p>
                        <UserGroupIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">On duty now</h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="font-mono text-[22px] font-black tabular-nums text-licorice">{staffOnShift}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">On Shift</p>
                        </div>
                        <div className="rounded-xl bg-isabelline p-3 text-center">
                            <p className="font-mono text-[22px] font-black tabular-nums text-licorice">{totalStaff}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Total Staff</p>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Waiters on floor</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">3</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Kitchen staff</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">2</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-licorice">Bartenders</span>
                            <span className="font-mono font-bold tabular-nums text-feldgrau">1</span>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2">
                        <CheckBadgeIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
                        <span className="text-[10px] font-bold tracking-tight text-emerald-700">
                            All stations fully covered
                        </span>
                    </div>
                </div>

                {/* ── Quick Stats ── */}
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
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">47</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <CheckBadgeIcon className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Completed</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">32</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-isabelline pb-2">
                            <div className="flex items-center gap-2">
                                <ArrowUpRightIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Avg order value</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">{formatGHS(154)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">Guests served</span>
                            </div>
                            <span className="font-mono text-[14px] font-black tabular-nums text-licorice">118</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               RECENT ACTIVITIES TABLE — Like Vendly's
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
                        {RECENT_ORDERS.map((order) => (
                            <tr key={order.id} className="group hover:bg-isabelline/30 transition-colors cursor-pointer">
                                <td className="py-3 pr-2">
                                    <span className="font-bold text-[11px] text-feldgrau">{order.ref}</span>
                                </td>
                                <td className="py-3 pr-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-isabelline flex items-center justify-center text-[9px] font-bold text-feldgrau uppercase">
                                            {order.customer.split(" ").map(n => n[0]).join("").slice(0, 2)}
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

                {RECENT_ORDERS.length === 0 && (
                    <div className="text-center py-12 text-feldgrau text-xs">No recent orders.</div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
               FOOTER STATUS BAR
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] bg-licorice px-5 py-3 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                <span className="text-[11px] font-bold tracking-tight">
                    NightOS &middot; {formatCompact(todayRevenue)} today &middot; {openOrders} open &middot; {occupiedTables}/{totalTables} tables
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-isabelline/60">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Auto-refreshing every 15s
                </span>
            </div>
        </div>
    );
}