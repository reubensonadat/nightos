import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeftIcon,
    ArrowTrendingUpIcon,
    BanknotesIcon,
    ChartBarIcon,
    ClockIcon,
    TableCellsIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";

/* ────────────────────────── Types ────────────────────────── */

type ShiftActivity = {
    type: "settlement" | "table" | "tip";
    label: string;
    amount: number;
    ts: string;
};

type ShiftSummary = {
    ok: boolean;
    error?: string;
    sales: number;
    tables_served: number;
    items_sold: number;
    shift_seconds: number;
    activity: ShiftActivity[];
};

const COMMISSION_RATE = 0.03; // 3% of sales

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    staffId: string;
    staffName: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ShiftPerformanceScreen({ staffId, staffName }: Props) {
    const navigate = useNavigate();
    const onBack = () => navigate('/waiter');
    const [summary, setSummary] = useState<ShiftSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await db.staffShiftSummary(staffId);
            
            const isEmptyData = 
                (Array.isArray(data) && data.length === 0) || 
                (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);

            if (isEmptyData || data?.error === "staff_not_found") {
                setError("staff_not_found");
            } else if (!data || data.ok === false) {
                setError(data?.error ?? "Could not load your shift.");
            } else {
                setSummary(data);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load your shift.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            await load();
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [staffId]);

    const hoursOnShift = summary ? summary.shift_seconds / 3600 : 0;
    const avgBill =
        summary && summary.tables_served > 0
            ? summary.sales / summary.tables_served
            : 0;
    const commission = summary ? summary.sales * COMMISSION_RATE : 0;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex items-center justify-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            My Shift
                        </span>
                    </div>

                    <div className="w-9" />
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-5 pb-8">
                {loading && (
                    <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-isabelline">
                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-khaki border-t-transparent" />
                        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                            Loading your shift…
                        </p>
                    </div>
                )}

                {!loading && error === 'staff_not_found' && (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm mt-6">
                        {/* Typography */}
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No tables yet</h3>
                        <p className="text-sm text-slate-500 mb-8 max-w-[250px] mx-auto">
                            Serve your first table to see your revenue and shift metrics appear here.
                        </p>
                        
                        {/* Action: Redirect to Floor */}
                        <button 
                            onClick={onBack}
                            className="w-full py-2.5 rounded-xl bg-[#2A1A17] text-white font-bold text-base transition-colors active:scale-[0.98]">
                            Back to Floorplan
                        </button>
                    </div>
                )}

                {!loading && error && error !== 'staff_not_found' && (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-isabelline">
                        <p className="text-[12px] font-bold text-licorice">{error}</p>
                        <button
                            type="button"
                            onClick={load}
                            className="mt-4 rounded-xl bg-licorice px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-isabelline active:scale-95"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!loading && !error && summary && (
                    <>
                        {/* ── Hero stats card ── */}
                        <div className="overflow-hidden rounded-2xl bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)]">
                            <div className="px-5 pt-5 pb-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                        Today's Sales
                                    </p>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-khaki/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-khaki">
                                        <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                        Live
                                    </span>
                                </div>
                                <p className="mt-1.5 font-mono text-[32px] font-black leading-none tabular-nums">
                                    {formatGHS(summary.sales)}
                                </p>
                                <p className="mt-1.5 text-[10.5px] font-medium tracking-tight text-isabelline/60">
                                    Settled payments on your bills this shift
                                </p>
                            </div>

                            {/* Shift duration bar */}
                            <div className="border-t border-isabelline/10 px-5 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <ClockIcon className="h-3.5 w-3.5 text-isabelline/60" strokeWidth={2} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-isabelline/60">
                                            On Shift
                                        </span>
                                    </div>
                                    <span className="font-mono text-[12px] font-bold tabular-nums text-isabelline">
                                        {Math.floor(hoursOnShift)}h {Math.round((hoursOnShift % 1) * 60)}m
                                    </span>
                                </div>
                                {/* Shift progress bar (8 hour shift) */}
                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-isabelline/10">
                                    <div
                                        className="h-full rounded-full bg-khaki transition-all duration-500"
                                        style={{ width: `${Math.min(100, (hoursOnShift / 8) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── KPI grid ── */}
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-isabelline">
                                <TableCellsIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <p className="mt-2 font-mono text-[18px] font-black tabular-nums text-licorice">
                                    {summary.tables_served}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                    Tables
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-isabelline">
                                <ChartBarIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <p className="mt-2 font-mono text-[18px] font-black tabular-nums text-licorice">
                                    {formatGHS(avgBill)}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                    Avg Bill
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-isabelline">
                                <UserGroupIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <p className="mt-2 font-mono text-[18px] font-black tabular-nums text-licorice">
                                    {summary.items_sold}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                    Items
                                </p>
                            </div>
                        </div>

                        {/* ── Earnings card ── */}
                        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline">
                            <div className="border-b border-isabelline px-5 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                    My Earnings
                                </p>
                                <p className="mt-1 font-mono text-[24px] font-black tabular-nums text-licorice">
                                    {formatGHS(commission)}
                                </p>
                            </div>

                            <div className="divide-y divide-isabelline">
                                <div className="flex items-center justify-between px-5 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <BanknotesIcon className="h-3.5 w-3.5 text-feldgrau" strokeWidth={2} />
                                        <span className="text-[11px] font-medium tracking-tight text-feldgrau">
                                            Commission (3% of sales)
                                        </span>
                                    </div>
                                    <span className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                                        {formatGHS(commission)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Activity feed ── */}
                        <div className="mt-5">
                            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                                Recent Activity
                            </p>
                            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                                {summary.activity.length === 0 && (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-[11px] font-semibold tracking-tight text-feldgrau">
                                            No activity on this shift yet.
                                        </p>
                                    </div>
                                )}
                                {summary.activity.map((entry, idx) => (
                                    <div
                                        key={`${entry.type}-${entry.ts}-${idx}`}
                                        className={`flex items-center justify-between px-4 py-2.5 ${idx < summary.activity.length - 1 ? "border-b border-isabelline" : ""}`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${entry.type === "settlement"
                                                    ? "bg-khaki"
                                                    : entry.type === "tip"
                                                        ? "bg-licorice"
                                                        : "bg-feldgrau"
                                                    }`}
                                            />
                                            <div>
                                                <p className="text-[11.5px] font-bold tracking-tight text-licorice">
                                                    {entry.label}
                                                </p>
                                                <p className="text-[9.5px] font-semibold tracking-tight text-feldgrau">
                                                    {relativeTime(entry.ts)}
                                                </p>
                                            </div>
                                        </div>
                                        {entry.amount > 0 && (
                                            <span className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                                                {formatGHS(entry.amount)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diff / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
}
