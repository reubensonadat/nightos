import { useEffect, useMemo, useState } from "react";
import {
    ArrowDownTrayIcon,
    CalendarIcon,
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
import { db } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import clsx from "clsx";

const CHART_COLORS = ["#23140C", "#D0BA98", "#606F69", "#91040C", "#A9CFE0"];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function FinancialReportsScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [timeFilter, setTimeFilter] = useState<string>("30D");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [payments, setPayments] = useState<{
        id: string;
        amount: number;
        method: string;
        bill_id: string | null;
        payer_name: string | null;
        created_at: string;
    }[]>([]);
    const [expenses, setExpenses] = useState<{
        category: string;
        amount: number;
    }[]>([]);
    const [items, setItems] = useState<{
        product_name: string;
        quantity: number;
        line_total: number;
    }[]>([]);
    const [submissions, setSubmissions] = useState<{ created_at: string }[]>([]);
    const [customers, setCustomers] = useState<{
        id: string;
        name: string | null;
        total_visits: number;
    }[]>([]);

    const sinceIso = useMemo(() => {
        const now = Date.now();
        const day = 86400000;
        if (timeFilter === "ALL_TIME") return null;
        if (timeFilter === "1Y") return new Date(now - 365 * day).toISOString();
        if (timeFilter === "90D") return new Date(now - 90 * day).toISOString();
        if (timeFilter === "30D") return new Date(now - 30 * day).toISOString();
        if (timeFilter === "7D") return new Date(now - 7 * day).toISOString();
        if (timeFilter === "CUSTOM" && customStart && customEnd) {
            return new Date(`${customStart}T00:00:00`).toISOString();
        }
        return null;
    }, [timeFilter, customStart, customEnd]);

    const load = async () => {
        if (!venue || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setLoading(true);
        setError(null);
        try {
            const fetched: {
                id: string;
                amount: number;
                method: string;
                bill_id: string | null;
                payer_name: string | null;
                created_at: string;
            }[] = [];
            for (let page = 0; page < 6; page++) {
                const from = page * 500;
                const to = from + 499;
                const { data, error: err } = await db.paymentsAll(venue.id, from, to);
                if (err) throw err;
                if (!data || data.length === 0) break;
                fetched.push(...data);
                if (data.length < 500) break;
            }
            const cut = sinceIso ?? "1970-01-01T00:00:00";
            const inRange = fetched.filter((p) => p.created_at >= cut);
            setPayments(inRange);

            const { data: expenseRows, error: expErr } = await db.expensesByVenue(venue.id);
            if (expErr) throw expErr;
            setExpenses(
                (expenseRows ?? [])
                    .filter((e) => e.expense_date >= cut)
                    .map((e) => ({ category: e.category, amount: e.amount })),
            );

            const billIds = [...new Set(inRange.map((p) => p.bill_id).filter((b): b is string => !!b))];
            if (billIds.length > 0) {
                const [{ data: itemRows }, { data: subRows }] = await Promise.all([
                    supabaseItemsFor(billIds),
                    supabaseSubsFor(billIds),
                ]);
                setItems(itemRows ?? []);
                setSubmissions(subRows ?? []);
            } else {
                setItems([]);
                setSubmissions([]);
            }

            const { data: custRows, error: custErr } = await supabaseCustomers(venue.id);
            if (custErr) throw custErr;
            setCustomers(custRows ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load financial data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [venue?.id, sinceIso]);

    useEffect(() => {
        if (!venue || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const channel = supabaseChannel(`finance:${venue.id}`);
        channel
            .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `venue_id=eq.${venue.id}` }, () => {
                clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => load(), 800);
            })
            .subscribe();
        return () => {
            clearTimeout(reloadTimer);
            supabaseRemove(channel);
        };
    }, [venue?.id, sinceIso]);

    const financials = useMemo(() => computeFinancials(payments, expenses, items, submissions, customers), [payments, expenses, items, submissions, customers]);



    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-[26px] font-black tracking-[-0.03em] text-licorice">
                        Analytics
                    </h1>
                    <p className="text-[12px] text-feldgrau mt-0.5">Live from your venue's bills, payments & expenses</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Time filter selector */}
                    <div className="relative">
                        <select
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="appearance-none rounded-full ring-1 ring-licorice/8 bg-white pl-10 pr-8 py-2 text-sm font-semibold text-licorice outline-none focus:ring-2 focus:ring-licorice/20 cursor-pointer hover:bg-isabelline transition-all"
                        >
                            <option value="ALL_TIME">All Time</option>
                            <option value="1Y">Past Year</option>
                            <option value="90D">Past 90 Days</option>
                            <option value="30D">Past 30 Days</option>
                            <option value="7D">Past 7 Days</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                        <CalendarIcon className="h-4 w-4 text-feldgrau absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {timeFilter === "CUSTOM" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-full ring-1 ring-licorice/8 bg-white px-4 py-2 text-sm font-semibold text-licorice outline-none focus:ring-2 focus:ring-licorice/20 hover:bg-isabelline transition-all"
                            />
                            <span className="text-sm font-semibold text-feldgrau">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-full ring-1 ring-licorice/8 bg-white px-4 py-2 text-sm font-semibold text-licorice outline-none focus:ring-2 focus:ring-licorice/20 hover:bg-isabelline transition-all"
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full bg-licorice text-isabelline px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(35,20,12,0.18)] hover:bg-licorice/95 active:scale-[0.97] transition-all"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" strokeWidth={2} />
                        Export
                    </button>
                </div>
            </div>

            {loading && (
                <div className="rounded-[1.5rem] bg-white p-14 text-center shadow-sm ring-1 ring-licorice/5">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-khaki border-t-transparent" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-feldgrau">
                        Crunching your numbers…
                    </p>
                </div>
            )}

            {!loading && error && (
                <div className="rounded-[1.5rem] bg-white p-12 text-center shadow-sm ring-1 ring-licorice/5">
                    <p className="text-[12px] font-bold text-licorice">{error}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-4 rounded-xl bg-licorice px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-isabelline active:scale-95"
                    >
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* ── Stat Widgets Grid (like Vendly Analytics) ── */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
                        <StatWidget title="Net Profit" value={formatGHS(financials.netProfit)} className="lg:col-span-2" />
                        <StatWidget title="Total Revenue" value={formatGHS(financials.totalRevenue)} className="lg:col-span-2" />
                        <StatWidget title="Expenses" value={formatGHS(financials.totalExpenses)} className="lg:col-span-2" />
                        <StatWidget title="Paid Orders" value={String(financials.paidOrders)} className="lg:col-span-2" />
                        <StatWidget title="Average Order" value={formatGHS(financials.aov)} className="lg:col-span-2" />
                        <StatWidget title="Return Rate" value={`${financials.returnRate.toFixed(1)}%`} className="lg:col-span-2" />
                    </div>

                    {/* ── Middle Row: Money Flow + Sales Volume Pie ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Money Flow bar chart */}
                        <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Money Flow</h2>
                                <div className="hidden sm:flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-feldgrau">
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
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Sales Volume</h2>

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
                                    <span className="text-[8px] uppercase font-bold text-feldgrau ">Total Qty</span>
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

                    {/* ── Bottom Row: Top Items + Peak Times ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Top items by revenue */}
                        <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Top Items</h2>

                            <div className="space-y-4">
                                {financials.revenueByItem.map((item, i) => {
                                    const pct = Math.min(100, Math.max(0, (item.Revenue / (financials.totalRevenue || 1)) * 100));
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="truncate font-bold tracking-tight text-licorice max-w-[140px]">{item.name}</span>
                                                <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(item.Revenue)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-isabelline">
                                                    <div className="h-full rounded-full bg-licorice transition-all duration-500" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="shrink-0 text-xs font-bold text-feldgrau">{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {financials.revenueByItem.length === 0 && (
                                    <p className="text-center py-8 text-feldgrau text-xs">No data available</p>
                                )}
                            </div>
                        </div>

                        {/* Peak Order Times — dark card like Vendly */}
                        <div className="lg:col-span-2 rounded-[1.5rem] bg-white border border-slate-100 text-slate-900 p-5 md:p-6">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Peak Order Times</h2>

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
                                                    isPeak ? "bg-khaki" : "bg-slate-100 group-hover:bg-slate-200"
                                                )}
                                                style={{ height: `${Math.max(heightPct, 4)}%` }}
                                            />
                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-licorice text-[8px] font-bold px-2 py-1 rounded pointer-events-none z-20 whitespace-nowrap shadow">
                                                {hourData.formatted}: {hourData.count} orders
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-2 text-[8px] font-bold uppercase text-slate-400">
                                <span>12AM</span>
                                <span>6AM</span>
                                <span>12PM</span>
                                <span>6PM</span>
                                <span>11PM</span>
                            </div>
                        </div>
                    </div>

                    {/* ── P&L Breakdown Table ── */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-licorice/5 overflow-hidden">
                        <div className="border-b border-isabelline px-5 py-3">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Profit & Loss</h2>
                        </div>
                        <table className="w-full">
                            <thead className="border-b border-isabelline bg-isabelline/30">
                                <tr className="text-left">
                                    <th className="px-5 py-2.5 text-xs font-bold uppercase text-feldgrau">Category</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-bold uppercase text-feldgrau">Amount</th>
                                    <th className="hidden md:table-cell px-5 py-2.5 text-right text-xs font-bold uppercase text-feldgrau">% of Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-isabelline text-[11.5px]">
                                <tr>
                                    <td className="pl-4 pr-5 py-2.5 font-bold tracking-tight text-licorice">Gross Revenue</td>
                                    <td className="px-5 py-2.5 text-right tabular-nums font-bold text-licorice">{formatGHS(financials.totalRevenue)}</td>
                                    <td className="hidden md:table-cell px-5 py-2.5 text-right tabular-nums text-feldgrau">100%</td>
                                </tr>
                                {financials.expenseBreakdown.map((row) => (
                                    <tr key={row.category}>
                                        <td className="pl-8 pr-5 py-2.5 font-medium tracking-tight text-slate-600">{row.category}</td>
                                        <td className="px-5 py-2.5 text-right tabular-nums text-dark-red">−{formatGHS(row.amount)}</td>
                                        <td className="hidden md:table-cell px-5 py-2.5 text-right tabular-nums text-feldgrau">{((row.amount / (financials.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                                {financials.expenseBreakdown.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center text-sm text-slate-400 italic py-6">No expenses recorded this period</td>
                                    </tr>
                                )}
                                <tr className="bg-slate-50 border-t-2 border-slate-200 text-slate-900 font-bold">
                                    <td className="pl-4 pr-5 py-3 font-bold tracking-tight">Net Profit</td>
                                    <td className="px-5 py-3 text-right tabular-nums font-bold">{formatGHS(financials.netProfit)}</td>
                                    <td className="hidden md:table-cell px-5 py-3 text-right tabular-nums font-bold text-slate-900">{((financials.netProfit / (financials.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Recent Transactions ── */}
                    <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-5">Recent Transactions</h2>
                            <span className="text-xs text-feldgrau font-medium">{financials.recentOrders.length} transactions</span>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left text-xs min-w-[500px]">
                                <thead>
                                    <tr className="uppercase text-xs font-bold text-feldgrau border-b border-isabelline">
                                        <th className="pb-3 font-normal">Date</th>
                                        <th className="pb-3 font-normal">Amount</th>
                                        <th className="pb-3 font-normal">Customer</th>
                                        <th className="pb-3 font-normal">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-isabelline/60">
                                    {financials.recentOrders.map((o) => (
                                        <tr key={o.id} className="group hover:bg-isabelline/30 transition-colors">
                                            <td className="py-3 font-medium text-feldgrau text-xs">
                                                {new Date(o.created_at).toLocaleDateString("en-GH", { day: "2-digit", month: "short" })}
                                            </td>
                                            <td className="py-3 font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(o.amount)}</td>
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-isabelline flex items-center justify-center text-[8px] font-bold text-feldgrau uppercase">
                                                        {o.customer_name ? o.customer_name.substring(0, 2) : "CU"}
                                                    </div>
                                                    <span className="font-semibold text-xs text-licorice">{o.customer_name || "Walk-in"}</span>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
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
                </>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA LAYER (all real Supabase reads — owner RLS)
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../../lib/supabase";

let reloadTimer: ReturnType<typeof setTimeout>;

const supabaseItemsFor = (billIds: string[]) =>
    supabase
        .from("order_items")
        .select("product_name, quantity, line_total")
        .in("bill_id", billIds)
        .limit(2000);

const supabaseSubsFor = (billIds: string[]) =>
    supabase
        .from("order_submissions")
        .select("created_at")
        .in("bill_id", billIds)
        .limit(2000);

const supabaseCustomers = (venueId: string) =>
    supabase
        .from("customer_profiles")
        .select("id, name, total_visits")
        .eq("venue_id", venueId)
        .limit(2000);

const supabaseChannel = (topic: string) => supabase.channel(topic);
const supabaseRemove = (channel: ReturnType<typeof supabase.channel>) => {
    supabase.removeChannel(channel);
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPUTATION — pure functions over the real rows
   ═══════════════════════════════════════════════════════════════════════════ */

type PaymentRow = { id: string; amount: number; method: string; bill_id: string | null; payer_name: string | null; created_at: string };
type ExpenseRow = { category: string; amount: number };
type ItemRow = { product_name: string; quantity: number; line_total: number };
type SubRow = { created_at: string };
type CustomerRow = { id: string; name: string | null; total_visits: number };

type Financials = {
    netProfit: number;
    totalRevenue: number;
    totalExpenses: number;
    paidOrders: number;
    aov: number;
    returnRate: number;
    monthlyFlow: { name: string; Income: number; Expense: number }[];
    salesQuantityByItem: { name: string; value: number }[];
    revenueByItem: { name: string; Revenue: number }[];
    peakHourInsight: string;
    hourlyDistribution: { formatted: string; count: number }[];
    recentOrders: { id: string; created_at: string; amount: number; customer_name: string | null }[];
    expenseBreakdown: { category: string; amount: number }[];
};

function computeFinancials(
    payments: PaymentRow[],
    expenses: ExpenseRow[],
    items: ItemRow[],
    submissions: SubRow[],
    customers: CustomerRow[],
): Financials {
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const paidOrders = new Set(payments.map((p) => p.bill_id).filter(Boolean)).size;
    const aov = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    const withVisits = customers.filter((c) => c.total_visits >= 2).length;
    const returnRate = customers.length > 0 ? (withVisits / customers.length) * 100 : 0;

    // Monthly income/expense for the last 12 months
    const months: { key: string; name: string; Income: number; Expense: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        months.push({
            key,
            name: d.toLocaleDateString("en-GH", { month: "short" }),
            Income: 0,
            Expense: 0,
        });
    }
    const monthKey = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${d.getMonth()}`;
    };
    payments.forEach((p) => {
        const m = months.find((x) => x.key === monthKey(p.created_at));
        if (m) m.Income += p.amount;
    });
    expenses.forEach((e) => {
        const d = new Date();
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const m = months.find((x) => x.key === key);
        if (m) m.Expense += e.amount;
    });

    // Item aggregates (quantity + revenue) from order_items of paid bills
    const qtyMap = new Map<string, number>();
    const revMap = new Map<string, number>();
    items.forEach((it) => {
        qtyMap.set(it.product_name, (qtyMap.get(it.product_name) ?? 0) + it.quantity);
        revMap.set(it.product_name, (revMap.get(it.product_name) ?? 0) + it.line_total);
    });
    const salesQuantityByItem = [...qtyMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const revenueByItem = [...revMap.entries()]
        .map(([name, Revenue]) => ({ name, Revenue }))
        .sort((a, b) => b.Revenue - a.Revenue)
        .slice(0, 6);

    // Hourly distribution from submissions
    const hours = new Array(24).fill(0);
    submissions.forEach((s) => {
        const h = new Date(s.created_at).getHours();
        hours[h] += 1;
    });
    const hourlyDistribution = hours.map((count, h) => ({
        count,
        formatted: formatHour(h),
    }));
    const peakHour = hourlyDistribution.reduce(
        (best, cur, i) => (cur.count > best.count ? { count: cur.count, index: i } : best),
        { count: 0, index: -1 },
    );
    const peakHourInsight =
        peakHour.index >= 0 && peakHour.count > 0
            ? `${hourlyDistribution[peakHour.index].formatted} is your busiest hour`
            : "No orders recorded yet";

    const recentOrders = payments
        .slice(0, 12)
        .map((p) => ({
            id: p.id,
            created_at: p.created_at,
            amount: p.amount,
            customer_name: p.payer_name ?? null,
        }));

    const expenseMap = new Map<string, number>();
    expenses.forEach((e) => expenseMap.set(e.category, (expenseMap.get(e.category) ?? 0) + e.amount));
    const expenseBreakdown = [...expenseMap.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

    return {
        netProfit,
        totalRevenue,
        totalExpenses,
        paidOrders,
        aov,
        returnRate,
        monthlyFlow: months.map(({ name, Income, Expense }) => ({ name, Income, Expense })),
        salesQuantityByItem,
        revenueByItem,
        peakHourInsight,
        hourlyDistribution,
        recentOrders,
        expenseBreakdown,
    };
}

function formatHour(h: number): string {
    const ampm = h < 12 ? "AM" : "PM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ampm}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT WIDGET — Reusable stat card (Vendly style)
   ═══════════════════════════════════════════════════════════════════════════ */

function StatWidget({
    title,
    value,
    className,
}: {
    title: string;
    value: React.ReactNode;
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
                <p className="text-xs font-bold uppercase text-feldgrau">{title}</p>
            </div>
            <p className="text-2xl font-bold font-sans tabular-nums tracking-tight text-slate-900 mb-3">
                {value}
            </p>
        </div>
    );
}
