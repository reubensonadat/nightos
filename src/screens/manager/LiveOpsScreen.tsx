import {
    ArrowTrendingUpIcon,
    BanknotesIcon,
    ChartBarIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ShoppingCartIcon,
    TableCellsIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";

/* ────────────────────────── Mock data ────────────────────────── */

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

/** Hourly revenue for the last 12 hours — used in the bar chart. */
const HOURLY_REVENUE = [
    { hour: "10A", value: 120 },
    { hour: "11A", value: 240 },
    { hour: "12P", value: 480 },
    { hour: "1P", value: 620 },
    { hour: "2P", value: 380 },
    { hour: "3P", value: 290 },
    { hour: "4P", value: 340 },
    { hour: "5P", value: 510 },
    { hour: "6P", value: 780 },
    { hour: "7P", value: 920 },
    { hour: "8P", value: 1240 },
    { hour: "9P", value: 1080 },
];

const TOP_ITEMS = [
    { name: "Velvet Old Fashioned", sold: 42, revenue: 2730 },
    { name: "Lamb Suya Skewers", sold: 38, revenue: 1710 },
    { name: "Cocoa Espresso Martini", sold: 31, revenue: 1705 },
    { name: "Hibiscus Spritz", sold: 28, revenue: 980 },
    { name: "Beef Tataki", sold: 22, revenue: 1540 },
];

/* ────────────────────────── Helpers ────────────────────────── */

function formatCompact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

/* ────────────────────────── Mini Bar Chart ────────────────────────── */

function MiniBarChart({ data }: { data: typeof HOURLY_REVENUE }) {
    const max = Math.max(...data.map((d) => d.value));
    return (
        <div className="flex h-32 items-end gap-1.5">
            {data.map((d, i) => {
                const heightPct = (d.value / max) * 100;
                const isPeak = d.value === max;
                return (
                    <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
                        <div className="relative w-full flex-1">
                            <div
                                className={`absolute bottom-0 w-full rounded-t-md transition-all duration-300 ${isPeak ? "bg-khaki" : "bg-licorice/70"}`}
                                style={{ height: `${heightPct}%` }}
                            />
                        </div>
                        <span className="text-[8px] font-bold tabular-nums text-feldgrau">{d.hour}</span>
                    </div>
                );
            })}
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

export function LiveOpsScreen() {
    const todayRevenue = HOURLY_REVENUE.reduce((sum, d) => sum + d.value, 0);
    const openOrders = 14;
    const occupiedTables = 6;
    const totalTables = 12;
    const avgWait = 8;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── KPI Grid ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {/* Revenue */}
                <div className="overflow-hidden rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)] md:p-5">
                    <div className="flex items-center justify-between">
                        <BanknotesIcon className="h-5 w-5 text-isabelline/60" strokeWidth={2} />
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-khaki/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">
                            <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                            +18%
                        </span>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">Today's Revenue</p>
                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums leading-none md:text-[28px]">{formatGHS(todayRevenue)}</p>
                    <p className="mt-1.5 text-[10px] font-medium tracking-tight text-isabelline/50">vs. {formatGHS(6100)} yesterday</p>
                </div>

                {/* Open Orders */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline md:p-5">
                    <div className="flex items-center justify-between">
                        <ShoppingCartIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                        <span className="rounded-full bg-khaki/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">Active</span>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Open Orders</p>
                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums leading-none text-licorice md:text-[28px]">{openOrders}</p>
                    <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">across kitchen + bar</p>
                </div>

                {/* Occupied Tables */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline md:p-5">
                    <div className="flex items-center justify-between">
                        <TableCellsIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                        <span className="rounded-full bg-feldgrau/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">{Math.round((occupiedTables / totalTables) * 100)}%</span>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Tables Occupied</p>
                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums leading-none text-licorice md:text-[28px]">
                        {occupiedTables}<span className="text-[14px] font-bold text-feldgrau">/{totalTables}</span>
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-isabelline">
                        <div className="h-full rounded-full bg-licorice transition-all duration-500" style={{ width: `${(occupiedTables / totalTables) * 100}%` }} />
                    </div>
                </div>

                {/* Avg Wait */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline md:p-5">
                    <div className="flex items-center justify-between">
                        <ClockIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                        <span className="rounded-full bg-khaki/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">Healthy</span>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg Order Wait</p>
                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums leading-none text-licorice md:text-[28px]">{avgWait}<span className="text-[14px] font-bold text-feldgrau">m</span></p>
                    <p className="mt-1.5 text-[10px] font-medium tracking-tight text-feldgrau">{"target < 15m"}</p>
                </div>
            </div>

            {/* ── Revenue chart + Top items ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Revenue chart */}
                <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Hourly Revenue</p>
                            <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Today · last 12 hours</h3>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-licorice/70" /> Hourly
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-khaki" /> Peak
                            </span>
                        </div>
                    </div>
                    <div className="mt-5">
                        <MiniBarChart data={HOURLY_REVENUE} />
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-isabelline pt-3 text-[11px]">
                        <span className="font-bold tracking-tight text-feldgrau">Peak: 8PM · {formatGHS(1240)}</span>
                        <span className="font-mono font-bold tabular-nums text-licorice">Avg/hr: {formatGHS(Math.round(todayRevenue / 12))}</span>
                    </div>
                </div>

                {/* Top items */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Top Sellers</p>
                        <ChartBarIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">By revenue</h3>
                    <ul className="mt-4 space-y-3">
                        {TOP_ITEMS.map((item, idx) => {
                            const maxRevenue = Math.max(...TOP_ITEMS.map((t) => t.revenue));
                            const pct = (item.revenue / maxRevenue) * 100;
                            return (
                                <li key={item.name}>
                                    <div className="flex items-center justify-between text-[11.5px]">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="font-mono text-[10px] font-bold tabular-nums text-feldgrau">{idx + 1}</span>
                                            <span className="truncate font-bold tracking-tight text-licorice">{item.name}</span>
                                        </span>
                                        <span className="shrink-0 font-mono font-bold tabular-nums text-licorice">{formatGHS(item.revenue)}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-isabelline">
                                            <div className="h-full rounded-full bg-khaki transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="shrink-0 text-[9px] font-bold tabular-nums text-feldgrau">{item.sold} sold</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            {/* ── Alerts ── */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-dark-red" strokeWidth={2} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-red">Alerts</p>
                    </div>
                    <span className="rounded-full bg-dark-red/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dark-red">{ALERTS.length} active</span>
                </div>
                <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Needs your attention</h3>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {ALERTS.map((alert) => (
                        <div
                            key={alert.id}
                            className={`flex items-start gap-3 rounded-xl border-l-2 px-3 py-2.5 ${alert.severity === "critical" ? "border-dark-red bg-dark-red/5" : "border-khaki bg-khaki/5"}`}
                        >
                            <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase ${alert.severity === "critical" ? "bg-dark-red/15 text-dark-red" : "bg-khaki/20 text-khaki"}`}>
                                {alert.type === "stock" ? "SKU" : alert.type === "wait" ? "MIN" : "SYS"}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-bold tracking-tight text-licorice">{alert.label}</p>
                                <p className="text-[10.5px] tracking-tight text-feldgrau">{alert.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer summary ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-licorice px-5 py-3 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                <span className="text-[11px] font-bold tracking-tight">
                    NightOS · {formatCompact(todayRevenue)} revenue · {openOrders} open orders · {occupiedTables}/{totalTables} tables
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-isabelline/60">
                    Auto-refreshing every 15s
                </span>
            </div>
        </div>
    );
}
