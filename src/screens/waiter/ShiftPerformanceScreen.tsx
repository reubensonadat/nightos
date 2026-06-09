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

/* ────────────────────────── Mock shift data ────────────────────────── */

type ActivityEntry = {
    id: string;
    type: "settlement" | "table" | "tip";
    label: string;
    amount: number;
    time: string;
};

const MOCK_ACTIVITY: ActivityEntry[] = [
    { id: "a1", type: "settlement", label: "Table 04 · Cash", amount: 245, time: "2m ago" },
    { id: "a2", type: "tip", label: "Tip · Table 06", amount: 40, time: "15m ago" },
    { id: "a3", type: "settlement", label: "Table 02 · MoMo", amount: 480, time: "32m ago" },
    { id: "a4", type: "table", label: "Opened Table 08", amount: 0, time: "45m ago" },
    { id: "a5", type: "settlement", label: "Table 07 · Card", amount: 180, time: "1h ago" },
    { id: "a6", type: "tip", label: "Tip · Table 03", amount: 25, time: "1h ago" },
];

const COMMISSION_RATE = 0.03; // 3% of sales

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    staffName: string;
    onBack: () => void;
};

export function ShiftPerformanceScreen({ staffName, onBack }: Props) {
    // Mock shift metrics
    const totalSales = 3450;
    const tablesServed = 12;
    const itemsSold = 47;
    const hoursOnShift = 5.5;
    const tipsEarned = 145;
    const avgBill = totalSales / tablesServed;
    const commission = totalSales * COMMISSION_RATE;
    const totalEarnings = commission + tipsEarned;

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

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            My Shift
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            {staffName} · Performance
                        </span>
                    </div>

                    <div className="w-9" />
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-5 pb-8">
                {/* ── Hero stats card ── */}
                <div className="overflow-hidden rounded-2xl bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)]">
                    <div className="px-5 pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                Today's Sales
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-khaki/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-khaki">
                                <ArrowTrendingUpIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                +18%
                            </span>
                        </div>
                        <p className="mt-1.5 font-mono text-[32px] font-black leading-none tabular-nums">
                            {formatGHS(totalSales)}
                        </p>
                        <p className="mt-1.5 text-[10.5px] font-medium tracking-tight text-isabelline/60">
                            vs. {formatGHS(2920)} yesterday
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
                            {tablesServed}
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
                            {itemsSold}
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
                            {formatGHS(totalEarnings)}
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
                        <div className="flex items-center justify-between px-5 py-2.5">
                            <div className="flex items-center gap-2">
                                <BanknotesIcon className="h-3.5 w-3.5 text-feldgrau" strokeWidth={2} />
                                <span className="text-[11px] font-medium tracking-tight text-feldgrau">
                                    Tips earned
                                </span>
                            </div>
                            <span className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                                {formatGHS(tipsEarned)}
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
                        {MOCK_ACTIVITY.map((entry, idx) => (
                            <div
                                key={entry.id}
                                className={`flex items-center justify-between px-4 py-2.5 ${idx < MOCK_ACTIVITY.length - 1 ? "border-b border-isabelline" : ""}`}
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
                                            {entry.time}
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
            </section>
        </main>
    );
}
