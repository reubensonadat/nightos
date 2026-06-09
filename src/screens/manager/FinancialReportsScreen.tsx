import { useState } from "react";
import {
    ArrowDownTrayIcon,
    ArrowTrendingUpIcon,
    BanknotesIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";

/* ────────────────────────── Mock data ────────────────────────── */

/** 7-day daily revenue */
const DAILY_REVENUE = [
    { day: "Mon", revenue: 4200, costs: 1800 },
    { day: "Tue", revenue: 3800, costs: 1650 },
    { day: "Wed", revenue: 5100, costs: 2100 },
    { day: "Thu", revenue: 4600, costs: 1950 },
    { day: "Fri", revenue: 7800, costs: 3100 },
    { day: "Sat", revenue: 9200, costs: 3600 },
    { day: "Sun", revenue: 6400, costs: 2500 },
];

const REVENUE_BY_ITEM = [
    { name: "Velvet Old Fashioned", revenue: 4200, share: 22 },
    { name: "Lamb Suya Skewers", revenue: 2800, share: 14 },
    { name: "Cocoa Espresso Martini", revenue: 2400, share: 12 },
    { name: "Beef Tataki", revenue: 1900, share: 10 },
    { name: "Hibiscus Spritz", revenue: 1500, share: 8 },
];

const REVENUE_BY_STAFF = [
    { name: "Ama Boateng", revenue: 6200, tables: 48 },
    { name: "Kojo Mensah", revenue: 4800, tables: 38 },
    { name: "Yaw Ankomah", revenue: 2100, tables: 18 },
];

type Period = "7d" | "30d" | "90d";

/* ────────────────────────── Line Chart ────────────────────────── */

function LineChart({ data }: { data: typeof DAILY_REVENUE }) {
    const max = Math.max(...data.map((d) => d.revenue));
    const min = Math.min(...data.map((d) => d.revenue));
    const range = max - min || 1;
    const width = 100;
    const height = 100;
    const step = width / (data.length - 1);

    const points = data
        .map((d, i) => {
            const x = i * step;
            const y = height - ((d.revenue - min) / range) * height * 0.85 - 7.5;
            return `${x},${y}`;
        })
        .join(" ");

    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <div className="relative h-48 w-full">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
                {/* Grid lines */}
                {[25, 50, 75].map((y) => (
                    <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="rgba(143, 106, 55, 0.08)" strokeWidth="0.2" />
                ))}
                {/* Area */}
                <polygon points={areaPoints} fill="rgba(143, 106, 55, 0.15)" />
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#8F6A37"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 2.5 }}
                />
                {/* Data points */}
                {data.map((d, i) => {
                    const x = i * step;
                    const y = height - ((d.revenue - min) / range) * height * 0.85 - 7.5;
                    return <circle key={i} cx={x} cy={y} r="1.2" fill="#23140C" />;
                })}
            </svg>
            {/* X-axis labels */}
            <div className="absolute inset-x-0 bottom-0 top-auto -mb-5 flex justify-between px-1">
                {data.map((d) => (
                    <span key={d.day} className="text-[9px] font-bold tabular-nums text-feldgrau">{d.day}</span>
                ))}
            </div>
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

export function FinancialReportsScreen() {
    const [period, setPeriod] = useState<Period>("7d");

    const totalRevenue = DAILY_REVENUE.reduce((s, d) => s + d.revenue, 0);
    const totalCosts = DAILY_REVENUE.reduce((s, d) => s + d.costs, 0);
    const grossProfit = totalRevenue - totalCosts;
    const margin = (grossProfit / totalRevenue) * 100;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Period selector + Export ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-isabelline">
                    {(["7d", "30d", "90d"] as Period[]).map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPeriod(p)}
                            className={`rounded-full px-4 py-1.5 text-[11px] font-bold tracking-tight transition-all ${period === p ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"}`}
                        >
                            {p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : "Last 90 days"}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[11px] font-bold tracking-tight text-licorice shadow-sm ring-1 ring-licorice/8 transition-all hover:bg-isabelline active:scale-95"
                >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    Export CSV
                </button>
            </div>

            {/* ── P&L Summary ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <BanknotesIcon className="h-5 w-5 text-isabelline/60" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">Revenue</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none md:text-[24px]">{formatGHS(totalRevenue)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <ChartBarIcon className="h-5 w-5 text-feldgrau" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Costs (COGS)</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-licorice md:text-[24px]">{formatGHS(totalCosts)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Gross Profit</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-khaki md:text-[24px]">{formatGHS(grossProfit)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Margin</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-khaki md:text-[24px]">{margin.toFixed(1)}<span className="text-[14px]">%</span></p>
                </div>
            </div>

            {/* ── Revenue trend chart ── */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Revenue Trend</p>
                        <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Daily · last 7 days</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Best day</p>
                        <p className="font-mono text-[12px] font-bold tabular-nums text-khaki">Sat · {formatGHS(9200)}</p>
                    </div>
                </div>
                <div className="mt-8">
                    <LineChart data={DAILY_REVENUE} />
                </div>
            </div>

            {/* ── Revenue by item + by staff ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* By item */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Revenue by Item</p>
                    <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Top contributors</h3>
                    <ul className="mt-4 space-y-3">
                        {REVENUE_BY_ITEM.map((item) => (
                            <li key={item.name}>
                                <div className="flex items-center justify-between text-[11.5px]">
                                    <span className="truncate font-bold tracking-tight text-licorice">{item.name}</span>
                                    <span className="shrink-0 font-mono font-bold tabular-nums text-licorice">{formatGHS(item.revenue)}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isabelline">
                                        <div className="h-full rounded-full bg-khaki transition-all duration-500" style={{ width: `${item.share * 4}%` }} />
                                    </div>
                                    <span className="shrink-0 text-[9px] font-bold tabular-nums text-feldgrau">{item.share}%</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* By staff */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Revenue by Staff</p>
                    <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Waiter performance</h3>
                    <ul className="mt-4 space-y-3">
                        {REVENUE_BY_STAFF.map((s) => {
                            const maxRev = Math.max(...REVENUE_BY_STAFF.map((x) => x.revenue));
                            const pct = (s.revenue / maxRev) * 100;
                            return (
                                <li key={s.name}>
                                    <div className="flex items-center justify-between text-[11.5px]">
                                        <span className="truncate font-bold tracking-tight text-licorice">{s.name}</span>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[9px] font-bold tabular-nums text-feldgrau">{s.tables} tables</span>
                                            <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(s.revenue)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-isabelline">
                                        <div className="h-full rounded-full bg-licorice transition-all duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            {/* ── P&L breakdown table ── */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                <div className="border-b border-isabelline px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Profit & Loss</p>
                    <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Detailed breakdown</h3>
                </div>
                <table className="w-full">
                    <thead className="border-b border-isabelline bg-isabelline/30">
                        <tr className="text-left">
                            <th className="px-5 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Category</th>
                            <th className="px-5 py-2 text-right text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Amount</th>
                            <th className="hidden md:table-cell px-5 py-2 text-right text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">% of Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline text-[11.5px]">
                        <tr>
                            <td className="px-5 py-2 font-bold tracking-tight text-licorice">Gross Revenue</td>
                            <td className="px-5 py-2 text-right font-mono font-bold tabular-nums text-licorice">{formatGHS(totalRevenue)}</td>
                            <td className="hidden md:table-cell px-5 py-2 text-right font-mono tabular-nums text-feldgrau">100%</td>
                        </tr>
                        <tr>
                            <td className="px-5 py-2 pl-8 font-medium tracking-tight text-feldgrau">Cost of Goods (food & bev)</td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-dark-red">−{formatGHS(totalCosts)}</td>
                            <td className="hidden md:table-cell px-5 py-2 text-right font-mono tabular-nums text-feldgrau">{((totalCosts / totalRevenue) * 100).toFixed(1)}%</td>
                        </tr>
                        <tr className="bg-khaki/5">
                            <td className="px-5 py-2 font-bold tracking-tight text-khaki">Gross Profit</td>
                            <td className="px-5 py-2 text-right font-mono font-bold tabular-nums text-khaki">{formatGHS(grossProfit)}</td>
                            <td className="hidden md:table-cell px-5 py-2 text-right font-mono font-bold tabular-nums text-khaki">{margin.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td className="px-5 py-2 pl-8 font-medium tracking-tight text-feldgrau">Staff wages</td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-dark-red">−{formatGHS(3200)}</td>
                            <td className="hidden md:table-cell px-5 py-2 text-right font-mono tabular-nums text-feldgrau">{((3200 / totalRevenue) * 100).toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td className="px-5 py-2 pl-8 font-medium tracking-tight text-feldgrau">Overhead (rent, utilities)</td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-dark-red">−{formatGHS(2400)}</td>
                            <td className="hidden md:table-cell px-5 py-2 text-right font-mono tabular-nums text-feldgrau">{((2400 / totalRevenue) * 100).toFixed(1)}%</td>
                        </tr>
                        <tr className="bg-licorice text-isabelline">
                            <td className="px-5 py-2.5 font-bold tracking-tight">Net Profit</td>
                            <td className="px-5 py-2.5 text-right font-mono text-[14px] font-black tabular-nums">{formatGHS(grossProfit - 3200 - 2400)}</td>
                            <td className="hidden md:table-cell px-5 py-2.5 text-right font-mono font-bold tabular-nums text-isabelline/80">
                                {(((grossProfit - 3200 - 2400) / totalRevenue) * 100).toFixed(1)}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
