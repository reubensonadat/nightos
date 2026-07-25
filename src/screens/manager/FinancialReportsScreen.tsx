import { useState, useMemo } from "react";
import {
    ArrowDownTrayIcon,
    ArrowTrendingUpIcon,
    ArrowUpRightIcon,
    CalendarIcon,
    ChartBarIcon,
    ClockIcon,
    UsersIcon,
} from "@heroicons/react/24/outline";
import {
    BarChart,
    Bar,
    XAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { formatGHS } from "../../data/menu";
import { ORDERS, EXPENSES, computeFinancials, type FinancialSummary } from "../../data/managerData";
import clsx from "clsx";

const CHART_COLORS = ["#23140C", "#D0BA98", "#606F69", "#91040C", "#A9CFE0"];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function FinancialReportsScreen() {
    const [timeFilter, setTimeFilter] = useState<string>("30D");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const financials = useMemo<FinancialSummary>(
        () => computeFinancials(ORDERS, EXPENSES, timeFilter, customStart, customEnd),
        [timeFilter, customStart, customEnd]
    );

    const trendText =
        timeFilter === "ALL_TIME"
            ? "All time"
            : timeFilter === "1Y"
                ? "Last 1 year"
                : timeFilter === "30D"
                    ? "Last 30 days"
                    : timeFilter === "90D"
                        ? "Last 90 days"
                        : timeFilter === "7D"
                            ? "Last 7 days"
                            : timeFilter === "CUSTOM" && customStart && customEnd
                                ? `${new Date(customStart).toLocaleDateString("en-GH", { day: "numeric", month: "short" })} – ${new Date(customEnd).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}`
                                : "Custom range";

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-[26px] font-black tracking-[-0.03em] text-licorice">
                        Analytics
                    </h1>
                    <p className="text-[12px] text-feldgrau mt-0.5">Full financial overview & performance metrics</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Time filter selector */}
                    <div className="relative">
                        <select
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="appearance-none rounded-full border border-licorice/10 bg-white pl-10 pr-8 py-2 text-[11px] font-bold tracking-tight text-licorice outline-none focus:ring-2 focus:ring-licorice/20 cursor-pointer"
                        >
                            <option value="ALL_TIME">All Time</option>
                            <option value="1Y">Past Year</option>
                            <option value="90D">Past 90 Days</option>
                            <option value="30D">Past 30 Days</option>
                            <option value="7D">Past 7 Days</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                        <CalendarIcon className="h-4 w-4 text-feldgrau absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {timeFilter === "CUSTOM" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-full border border-licorice/10 bg-white px-3 py-2 text-[10px] font-bold text-licorice outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                            <span className="text-[10px] text-feldgrau">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-full border border-licorice/10 bg-white px-3 py-2 text-[10px] font-bold text-licorice outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[11px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 hover:bg-isabelline active:scale-95 transition-all"
                    >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        Export
                    </button>
                </div>
            </div>

            {/* ── Stat Widgets Grid (like Vendly Analytics) ── */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
                <StatWidget title="Net Profit" value={formatGHS(financials.netProfit)} trend={trendText} positive={financials.netProfit > 0} className="lg:col-span-2" />
                <StatWidget title="Total Revenue" value={formatGHS(financials.totalRevenue)} trend={trendText} positive={true} className="lg:col-span-2" />
                <StatWidget title="Cost of Goods" value={formatGHS(financials.totalCost)} trend={trendText} positive={false} className="lg:col-span-2" />
                <StatWidget title="Tips Collected" value={formatGHS(financials.totalTips)} trend={trendText} positive={true} className="lg:col-span-2" />
                <StatWidget title="Average Order" value={formatGHS(financials.aov)} trend="Per checkout" positive={true} className="lg:col-span-2" />
                <StatWidget title="Return Rate" value={`${financials.returnRate.toFixed(1)}%`} trend="Repeat buyers" positive={financials.returnRate > 15} customIcon={<UsersIcon className="h-3.5 w-3.5" />} className="lg:col-span-2" />
            </div>

            {/* ── Middle Row: Money Flow + Sales Volume Pie ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Money Flow bar chart */}
                <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Money Flow</p>
                            <h3 className="text-[16px] font-bold tracking-tight text-licorice">{trendText}</h3>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-licorice" /> Income
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-sm bg-khaki" /> Expense
                            </span>
                        </div>
                    </div>

                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financials.monthlyFlow} barGap={4}>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#606F69", fontWeight: 600 }}
                                    dy={8}
                                />
                                <Tooltip
                                    cursor={{ fill: "#F3F3E3" }}
                                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "11px", fontWeight: "500", padding: "8px 12px" }}
                                    formatter={(value: unknown) => formatGHS(Number(value))}
                                />
                                <Bar dataKey="Income" fill="#23140C" radius={[6, 6, 6, 6]} barSize={16} />
                                <Bar dataKey="Expense" fill="#D0BA98" radius={[6, 6, 6, 6]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sales Volume Pie */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Sales Volume</p>
                        <ChartBarIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">By quantity</h3>

                    <div className="relative flex items-center justify-center min-h-[160px]">
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={financials.salesQuantityByItem}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={72}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {financials.salesQuantityByItem.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "11px", fontWeight: "500" }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[8px] uppercase font-bold text-feldgrau tracking-widest">Total Qty</span>
                            <span className="text-[18px] font-bold text-licorice">{financials.salesQuantityByItem.reduce((a, b) => a + b.value, 0)}</span>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        {financials.salesQuantityByItem.slice(0, 4).map((entry, index) => (
                            <div key={entry.name} className="flex items-center justify-between text-[10.5px]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                    <span className="truncate font-medium text-feldgrau max-w-[130px]">{entry.name}</span>
                                </div>
                                <span className="font-mono font-bold tabular-nums text-licorice">{entry.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Bottom Row: Profit Margins + Peak Times ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Profit Margins */}
                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Profit Margins</p>
                        <ArrowUpRightIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    </div>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mb-4">Top items</h3>

                    <div className="space-y-4">
                        {financials.profitByItem.map((item, i) => {
                            const pct = Math.min(100, Math.max(0, (item.Profit / (item.Revenue || 1)) * 100));
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                                        <span className="truncate font-bold tracking-tight text-licorice max-w-[140px]">{item.name}</span>
                                        <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(item.Profit)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isabelline">
                                            <div className="h-full rounded-full bg-licorice transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="shrink-0 text-[9px] font-bold text-feldgrau">{pct.toFixed(0)}%</span>
                                    </div>
                                </div>
                            );
                        })}
                        {financials.profitByItem.length === 0 && (
                            <p className="text-center py-8 text-feldgrau text-[11px]">No data available</p>
                        )}
                    </div>
                </div>

                {/* Peak Order Times — dark card like Vendly */}
                <div className="lg:col-span-2 rounded-[1.5rem] bg-licorice p-5 md:p-6 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.18)]">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/50">Peak Order Times</p>
                            <h3 className="text-[16px] font-bold tracking-tight text-isabelline mt-0.5">{financials.peakHourInsight}</h3>
                        </div>
                        <ClockIcon className="h-5 w-5 text-isabelline/40" strokeWidth={2} />
                    </div>

                    <div className="flex items-end justify-between gap-1 h-32 mt-4">
                        {financials.hourlyDistribution.map((hourData, i) => {
                            const maxCount = Math.max(...financials.hourlyDistribution.map((d) => d.count), 1);
                            const heightPct = (hourData.count / maxCount) * 100;
                            const isPeak = heightPct === 100 && hourData.count > 0;
                            return (
                                <div key={i} className="flex flex-col items-center w-full group relative">
                                    <div
                                        className={clsx(
                                            "w-full rounded-t-sm transition-all duration-500",
                                            isPeak ? "bg-khaki" : "bg-white/20 group-hover:bg-white/40"
                                        )}
                                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                                    />
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-licorice text-[8px] font-bold px-2 py-1 rounded pointer-events-none z-20 whitespace-nowrap">
                                        {hourData.formatted}: {hourData.count} orders
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-2 text-[8px] font-bold tracking-widest uppercase text-isabelline/30">
                        <span>12AM</span>
                        <span>6AM</span>
                        <span>12PM</span>
                        <span>6PM</span>
                        <span>11PM</span>
                    </div>
                </div>
            </div>

            {/* ── P&L Breakdown Table ── */}
            <div className="rounded-[1.5rem] bg-white shadow-sm ring-1 ring-licorice/5 overflow-hidden">
                <div className="border-b border-isabelline px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Profit & Loss</p>
                    <h3 className="text-[16px] font-bold tracking-tight text-licorice mt-0.5">{trendText}</h3>
                </div>
                <table className="w-full">
                    <thead className="border-b border-isabelline bg-isabelline/30">
                        <tr className="text-left">
                            <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Category</th>
                            <th className="px-5 py-2.5 text-right text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Amount</th>
                            <th className="hidden md:table-cell px-5 py-2.5 text-right text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">% of Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline text-[11.5px]">
                        <tr>
                            <td className="px-5 py-2.5 font-bold tracking-tight text-licorice">Gross Revenue</td>
                            <td className="px-5 py-2.5 text-right font-mono font-bold tabular-nums text-licorice">{formatGHS(financials.totalRevenue)}</td>
                            <td className="hidden md:table-cell px-5 py-2.5 text-right font-mono tabular-nums text-feldgrau">100%</td>
                        </tr>
                        <tr>
                            <td className="px-5 py-2.5 pl-10 font-medium tracking-tight text-feldgrau">Cost of Goods (food & bev)</td>
                            <td className="px-5 py-2.5 text-right font-mono tabular-nums text-dark-red">−{formatGHS(financials.totalCost)}</td>
                            <td className="hidden md:table-cell px-5 py-2.5 text-right font-mono tabular-nums text-feldgrau">{((financials.totalCost / (financials.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                        </tr>
                        <tr className="bg-khaki/5">
                            <td className="px-5 py-2.5 font-bold tracking-tight text-khaki">Gross Profit</td>
                            <td className="px-5 py-2.5 text-right font-mono font-bold tabular-nums text-khaki">{formatGHS(financials.totalRevenue - financials.totalCost)}</td>
                            <td className="hidden md:table-cell px-5 py-2.5 text-right font-mono font-bold tabular-nums text-khaki">{(((financials.totalRevenue - financials.totalCost) / (financials.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                        </tr>
                        {/* Expenses grouped */}
                        {["Food & Beverage", "Staff", "Overhead", "Utilities", "Maintenance", "Marketing"].map((cat) => {
                            const amt = EXPENSES.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
                            if (amt === 0) return null;
                            return (
                                <tr key={cat}>
                                    <td className="px-5 py-2.5 pl-10 font-medium tracking-tight text-feldgrau">{cat}</td>
                                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-dark-red">−{formatGHS(amt)}</td>
                                    <td className="hidden md:table-cell px-5 py-2.5 text-right font-mono tabular-nums text-feldgrau">{((amt / (financials.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-licorice text-isabelline">
                            <td className="px-5 py-3 font-bold tracking-tight">Net Profit</td>
                            <td className="px-5 py-3 text-right font-mono text-[14px] font-black tabular-nums">{formatGHS(financials.netProfit)}</td>
                            <td className="hidden md:table-cell px-5 py-3 text-right font-mono font-bold tabular-nums text-isabelline/80">{financials.profitMargin.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Recent Transactions ── */}
            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Activity</p>
                        <h3 className="text-[16px] font-bold tracking-tight text-licorice">Recent Transactions</h3>
                    </div>
                    <span className="text-[10px] text-feldgrau font-medium">{financials.recentOrders.length} transactions</span>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                            <tr className="uppercase tracking-widest text-[9px] font-bold text-feldgrau border-b border-isabelline">
                                <th className="pb-3 font-normal">Date</th>
                                <th className="pb-3 font-normal">Amount</th>
                                <th className="pb-3 font-normal">Customer</th>
                                <th className="pb-3 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-isabelline/60">
                            {financials.recentOrders.map((o) => (
                                <tr key={o.id} className="group hover:bg-isabelline/30 transition-colors">
                                    <td className="py-3 font-medium text-feldgrau text-[11px]">
                                        {new Date(o.created_at).toLocaleDateString("en-GH", { day: "2-digit", month: "short" })}
                                    </td>
                                    <td className="py-3 font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(o.total_amount)}</td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-isabelline flex items-center justify-center text-[8px] font-bold text-feldgrau uppercase">
                                                {o.customer_name ? o.customer_name.substring(0, 2) : "CU"}
                                            </div>
                                            <span className="font-semibold text-[11px] text-licorice">{o.customer_name || "Walk-in"}</span>
                                        </div>
                                    </td>
                                    <td className="py-3">
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                            Paid
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {financials.recentOrders.length === 0 && (
                        <p className="text-center py-8 text-feldgrau text-xs">No recent transactions for this period.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT WIDGET — Reusable stat card (Vendly style)
   ═══════════════════════════════════════════════════════════════════════════ */

function StatWidget({
    title,
    value,
    trend,
    positive,
    customIcon,
    className,
}: {
    title: string;
    value: string;
    trend: string;
    positive: boolean;
    customIcon?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={clsx(
                "rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 relative group hover:ring-licorice/15 transition-all",
                className
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">{title}</p>
                <div className="p-1.5 bg-isabelline rounded-full text-feldgrau/70 group-hover:bg-licorice group-hover:text-white transition-colors">
                    {customIcon || <ArrowUpRightIcon className="h-3.5 w-3.5" strokeWidth={2} />}
                </div>
            </div>
            <p className="font-mono text-[22px] md:text-[24px] font-black tabular-nums leading-none text-licorice mb-3">
                {value}
            </p>
            <div
                className={clsx(
                    "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md",
                    positive ? "text-emerald-600 bg-emerald-50" : "text-feldgrau bg-isabelline"
                )}
            >
                {positive ? <ArrowUpRightIcon className="h-2.5 w-2.5" strokeWidth={2.5} /> : <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                {trend}
            </div>
        </div>
    );
}