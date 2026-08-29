import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    BanknotesIcon,
    CalendarIcon,
    CheckBadgeIcon,
    ClockIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    ExclamationTriangleIcon,
    NoSymbolIcon,
    PrinterIcon,
    ShoppingCartIcon,
    UserGroupIcon,
    UserIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { formatGHS, formatGHSString } from "../../data/menu";
import { db } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import { useRealtime } from "../../hooks/useRealtime";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

export type ShiftFilterRange = "CURRENT" | "TODAY" | "YESTERDAY" | "LAST_7D" | "CUSTOM";

const PAYMENT_COLORS: Record<string, string> = {
    cash: "#23140C",
    card: "#D0BA98",
    mobile_money: "#606F69",
    bank_transfer: "#91040C",
    digital_wallet: "#A9CFE0",
    other: "#8C7A6B",
};

const PAYMENT_LABELS: Record<string, string> = {
    cash: "Cash",
    card: "Card (Visa/Mastercard)",
    mobile_money: "Mobile Money (MoMo)",
    bank_transfer: "Bank Transfer",
    digital_wallet: "Digital Wallet",
};

type PaymentMethodSummary = {
    method: string;
    label: string;
    amount: number;
    count: number;
    pct: number;
    platform_fee: number;
    color: string;
};

type WaiterPerformance = {
    staffId: string;
    name: string;
    role: string;
    isActive: boolean;
    ordersCount: number;
    itemsCount: number;
    totalSales: number;
    avgOrderValue: number;
    tablesServed: number;
    guestsServed: number;
    cancelledCount: number;
    cancelledValue: number;
};

type VoidItemDetail = {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    tableName: string;
    guestName: string;
    waiterName: string;
    time: string;
    notes: string | null;
};

type Props = {
    isModal?: boolean;
    onClose?: () => void;
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function ShiftReportScreen({ isModal = false, onClose }: Props) {
    const { venue } = useVenue("velvet-lounge");
    const [range, setRange] = useState<ShiftFilterRange>("CURRENT");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [activeTab, setActiveTab] = useState<"overview" | "payments" | "staff" | "voids" | "reconciliation">("overview");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Raw datasets from Supabase
    const [payments, setPayments] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    // Cash drawer reconciliation inputs
    const [startingFloat, setStartingFloat] = useState<number>(200);
    const [countedCash, setCountedCash] = useState<string>("");

    // Calculate time window boundaries
    const { sinceIso, untilIso, rangeLabel } = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        if (range === "CURRENT") {
            // Find earliest active shift clock-in or default to today's start
            const activeClockIns = shifts
                .filter((s) => s.status === "active" || s.status === "on_break")
                .map((s) => new Date(s.clock_in).getTime());
            const earliestClockIn = activeClockIns.length > 0 ? Math.min(...activeClockIns) : startOfToday.getTime();
            const start = new Date(Math.min(earliestClockIn, startOfToday.getTime()));
            return {
                sinceIso: start.toISOString(),
                untilIso: undefined,
                rangeLabel: `Current Shift (since ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
            };
        }

        if (range === "TODAY") {
            return {
                sinceIso: startOfToday.toISOString(),
                untilIso: undefined,
                rangeLabel: "Today's Shift (Full Day)",
            };
        }

        if (range === "YESTERDAY") {
            const yStart = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
            const yEnd = new Date(startOfToday.getTime() - 1);
            return {
                sinceIso: yStart.toISOString(),
                untilIso: yEnd.toISOString(),
                rangeLabel: `Yesterday (${yStart.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })})`,
            };
        }

        if (range === "LAST_7D") {
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return {
                sinceIso: start.toISOString(),
                untilIso: undefined,
                rangeLabel: "Last 7 Days",
            };
        }

        if (range === "CUSTOM" && customStart) {
            const start = new Date(`${customStart}T00:00:00`);
            const end = customEnd ? new Date(`${customEnd}T23:59:59`) : undefined;
            return {
                sinceIso: start.toISOString(),
                untilIso: end ? end.toISOString() : undefined,
                rangeLabel: `Custom Range (${customStart}${customEnd ? ` to ${customEnd}` : ""})`,
            };
        }

        return {
            sinceIso: startOfToday.toISOString(),
            untilIso: undefined,
            rangeLabel: "Today",
        };
    }, [range, shifts, customStart, customEnd]);

    // Data fetcher
    const loadShiftData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setLoading(true);
        setError(null);
        try {
            const res = await db.shiftReportData(venue.id, sinceIso, untilIso);
            if (res.error) throw new Error(res.error);
            setPayments(res.payments);
            setBills(res.bills);
            setSubmissions(res.submissions);
            setStaffList(res.staff);
            setShifts(res.shifts);
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("[ShiftReportScreen] Error fetching shift data:", err);
            setError(err instanceof Error ? err.message : "Failed to load shift report data.");
        } finally {
            setLoading(false);
        }
    }, [venue.id, sinceIso, untilIso]);

    useEffect(() => {
        loadShiftData();
    }, [loadShiftData]);

    // Realtime subscriptions
    useRealtime({
        table: "payments",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: loadShiftData,
        onUpdate: loadShiftData,
    });
    useRealtime({
        table: "bills",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: loadShiftData,
        onUpdate: loadShiftData,
    });
    useRealtime({
        table: "order_submissions",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: loadShiftData,
        onUpdate: loadShiftData,
    });

    /* ═══════════════════════════════════════════════════════════════════════
       COMPUTATIONS & METRICS
       ═══════════════════════════════════════════════════════════════════════ */

    // Successful payments
    const successfulPayments = useMemo(
        () => payments.filter((p) => p.status === "success"),
        [payments],
    );

    // 1. Revenue & High-level KPIs
    const totalGrossRevenue = useMemo(
        () => successfulPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        [successfulPayments],
    );

    const paidBills = useMemo(
        () => bills.filter((b) => b.status === "paid"),
        [bills],
    );

    const totalSubtotal = useMemo(
        () => paidBills.reduce((sum, b) => sum + Number(b.subtotal || 0), 0),
        [paidBills],
    );

    const totalVat = useMemo(
        () => paidBills.reduce((sum, b) => sum + Number(b.vat || 0), 0),
        [paidBills],
    );

    const totalServiceCharge = useMemo(
        () => paidBills.reduce((sum, b) => sum + Number(b.service_charge || 0), 0),
        [paidBills],
    );

    const totalPlatformFees = useMemo(
        () => successfulPayments.reduce((sum, p) => sum + Number(p.platform_fee || 0), 0),
        [successfulPayments],
    );

    const guestsServed = useMemo(
        () => paidBills.reduce((sum, b) => sum + (Number(b.guest_count) || 1), 0),
        [paidBills],
    );

    const ordersTakenCount = submissions.length;
    const fulfilledOrdersCount = submissions.filter((s) => s.status === "served").length;
    const cancelledOrdersCount = submissions.filter((s) => s.status === "cancelled").length;

    const avgOrderValue = ordersTakenCount > 0 ? totalGrossRevenue / ordersTakenCount : 0;
    const avgGuestSpend = guestsServed > 0 ? totalGrossRevenue / guestsServed : 0;

    // 2. Revenue Breakdown by Payment Method
    const paymentMethodsSummary = useMemo(() => {
        const map = new Map<string, { amount: number; count: number; platform_fee: number }>();
        for (const p of successfulPayments) {
            const m = p.method || "other";
            const cur = map.get(m) ?? { amount: 0, count: 0, platform_fee: 0 };
            cur.amount += Number(p.amount || 0);
            cur.count += 1;
            cur.platform_fee += Number(p.platform_fee || 0);
            map.set(m, cur);
        }

        const totalRev = totalGrossRevenue || 1;
        const result: PaymentMethodSummary[] = [];

        for (const [method, data] of map.entries()) {
            result.push({
                method,
                label: PAYMENT_LABELS[method] ?? method.replace("_", " ").toUpperCase(),
                amount: data.amount,
                count: data.count,
                pct: Math.round((data.amount / totalRev) * 100),
                platform_fee: data.platform_fee,
                color: PAYMENT_COLORS[method] ?? PAYMENT_COLORS.other,
            });
        }

        return result.sort((a, b) => b.amount - a.amount);
    }, [successfulPayments, totalGrossRevenue]);

    const cashCollected = useMemo(() => {
        const cashObj = paymentMethodsSummary.find((p) => p.method === "cash");
        return cashObj ? cashObj.amount : 0;
    }, [paymentMethodsSummary]);

    const digitalCollected = totalGrossRevenue - cashCollected;

    // 3. Staff & Waiter Performance Metrics
    const staffPerformance = useMemo(() => {
        const staffMap = new Map<string, WaiterPerformance>();

        // Pre-populate with all staff members
        for (const s of staffList) {
            staffMap.set(s.id, {
                staffId: s.id,
                name: s.name,
                role: s.role,
                isActive: s.is_active,
                ordersCount: 0,
                itemsCount: 0,
                totalSales: 0,
                avgOrderValue: 0,
                tablesServed: 0,
                guestsServed: 0,
                cancelledCount: 0,
                cancelledValue: 0,
            });
        }

        // Map bills to waiters
        const waiterTables = new Map<string, Set<string>>();
        for (const b of bills) {
            if (b.waiter_id) {
                const cur = staffMap.get(b.waiter_id);
                if (cur) {
                    if (b.status === "paid") {
                        cur.guestsServed += Number(b.guest_count || 1);
                    }
                    const tbls = waiterTables.get(b.waiter_id) ?? new Set<string>();
                    if (b.table_id) tbls.add(b.table_id);
                    waiterTables.set(b.waiter_id, tbls);
                }
            }
        }

        for (const [waiterId, tblSet] of waiterTables.entries()) {
            const cur = staffMap.get(waiterId);
            if (cur) cur.tablesServed = tblSet.size;
        }

        // Process order submissions
        for (const s of submissions) {
            const bill = Array.isArray(s.bills) ? s.bills[0] : s.bills;
            const waiterId = bill?.waiter_id;
            const targetStaffId = waiterId ?? "unknown";

            let cur = staffMap.get(targetStaffId);
            if (!cur) {
                cur = {
                    staffId: targetStaffId,
                    name: targetStaffId === "unknown" ? "Direct / Self-Order" : "Staff Member",
                    role: "waiter",
                    isActive: true,
                    ordersCount: 0,
                    itemsCount: 0,
                    totalSales: 0,
                    avgOrderValue: 0,
                    tablesServed: 0,
                    guestsServed: 0,
                    cancelledCount: 0,
                    cancelledValue: 0,
                };
                staffMap.set(targetStaffId, cur);
            }

            const items = s.order_items ?? [];
            const subTotal = items.reduce((sum: number, it: any) => sum + Number(it.line_total || 0), 0);
            const itemCount = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 1), 0);

            if (s.status === "cancelled") {
                cur.cancelledCount += 1;
                cur.cancelledValue += subTotal;
            } else {
                cur.ordersCount += 1;
                cur.itemsCount += itemCount;
                cur.totalSales += subTotal;
            }
        }

        // Compute averages
        for (const val of staffMap.values()) {
            val.avgOrderValue = val.ordersCount > 0 ? val.totalSales / val.ordersCount : 0;
        }

        return [...staffMap.values()]
            .filter((s) => s.ordersCount > 0 || s.cancelledCount > 0 || s.tablesServed > 0 || s.role === "waiter")
            .sort((a, b) => b.totalSales - a.totalSales);
    }, [staffList, bills, submissions]);

    // 4. Voids, Cancellations & Discounts
    const { voidDetails, totalVoidLostRevenue, cancelledBillsCount, totalDiscountsValue } = useMemo(() => {
        const details: VoidItemDetail[] = [];
        let lostSum = 0;

        // Cancellations from submissions and items
        for (const s of submissions) {
            const bill = Array.isArray(s.bills) ? s.bills[0] : s.bills;
            const tbl = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
            const staffMember = staffList.find((st) => st.id === bill?.waiter_id);

            const tableName = tbl ? (tbl.table_label ?? `Table ${tbl.table_number}`) : "Unassigned";
            const waiterName = staffMember ? staffMember.name : "Direct";

            for (const it of s.order_items ?? []) {
                if (it.status === "cancelled" || s.status === "cancelled") {
                    const lineVal = Number(it.line_total || it.unit_price * it.quantity || 0);
                    lostSum += lineVal;
                    details.push({
                        id: it.id || s.id,
                        productName: it.product_name || "Item",
                        quantity: Number(it.quantity || 1),
                        unitPrice: Number(it.unit_price || 0),
                        lineTotal: lineVal,
                        tableName,
                        guestName: s.guest_name || "Guest",
                        waiterName,
                        time: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        notes: it.notes || s.notes || null,
                    });
                }
            }
        }

        // Cancelled bills
        const cBills = bills.filter((b) => b.status === "cancelled");
        const cBillsCount = cBills.length;
        for (const cb of cBills) {
            lostSum += Number(cb.total || 0);
        }

        // Discounts / bill differences (subtotal vs final total adjusted)
        let discSum = 0;
        for (const b of paidBills) {
            const expectedSum = Number(b.subtotal || 0) + Number(b.service_charge || 0) + Number(b.vat || 0);
            const actualTotal = Number(b.total || 0);
            if (expectedSum > actualTotal) {
                discSum += expectedSum - actualTotal;
            }
        }

        return {
            voidDetails: details,
            totalVoidLostRevenue: lostSum,
            cancelledBillsCount: cBillsCount,
            totalDiscountsValue: discSum,
        };
    }, [submissions, bills, paidBills, staffList]);

    // 5. Cash Drawer Reconciliation Calculations
    const expectedCashInDrawer = startingFloat + cashCollected;
    const countedCashNumber = countedCash !== "" ? parseFloat(countedCash) : null;
    const cashVariance = countedCashNumber !== null ? countedCashNumber - expectedCashInDrawer : 0;

    // Print Shift Report
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={`mx-auto w-full ${isModal ? "p-4 md:p-6" : "max-w-7xl pb-16"}`}>
            {/* ═══════════════════════════════════════════════════════════
               HEADER BAR
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-licorice/8 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-khaki/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-khaki">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Shift Report
                        </span>
                        <span className="text-xs font-bold text-feldgrau">
                            Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    </div>
                    <h1 className="mt-1 font-display text-[26px] md:text-[28px] font-black tracking-[-0.03em] text-licorice">
                        End of Shift Summary
                    </h1>
                    <p className="text-xs font-semibold text-feldgrau mt-0.5">
                        {rangeLabel} &middot; {venue.name || "Velvet Lounge"}
                    </p>
                </div>

                {/* Filter and Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Shift Time Window Selector */}
                    <div className="relative">
                        <select
                            value={range}
                            onChange={(e) => setRange(e.target.value as ShiftFilterRange)}
                            className="appearance-none rounded-full ring-1 ring-licorice/8 bg-white pl-9 pr-8 py-2 text-xs font-bold text-licorice outline-none focus:ring-2 focus:ring-licorice/20 cursor-pointer hover:bg-isabelline transition-all shadow-sm"
                        >
                            <option value="CURRENT">Current Shift</option>
                            <option value="TODAY">Today (24h)</option>
                            <option value="YESTERDAY">Yesterday</option>
                            <option value="LAST_7D">Past 7 Days</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                        <CalendarIcon className="h-4 w-4 text-feldgrau absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {range === "CUSTOM" && (
                        <div className="flex items-center gap-1.5 text-xs">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-full ring-1 ring-licorice/8 bg-white px-3 py-1.5 font-bold text-licorice shadow-sm"
                            />
                            <span className="text-feldgrau font-semibold">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-full ring-1 ring-licorice/8 bg-white px-3 py-1.5 font-bold text-licorice shadow-sm"
                            />
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={loadShiftData}
                        title="Refresh numbers"
                        className="rounded-full bg-white p-2 text-feldgrau ring-1 ring-licorice/8 hover:bg-isabelline hover:text-licorice transition-all shadow-sm active:scale-95"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white text-licorice px-3.5 py-2 text-xs font-bold ring-1 ring-licorice/8 hover:bg-isabelline active:scale-95 transition-all shadow-sm"
                    >
                        <PrinterIcon className="h-4 w-4 text-feldgrau" />
                        Print Shift
                    </button>

                    {isModal && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full bg-isabelline p-2 text-feldgrau hover:bg-licorice hover:text-isabelline transition-all active:scale-95"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               NAVIGATION TABS
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-licorice/5">
                {[
                    { id: "overview", label: "Overview & KPIs" },
                    { id: "payments", label: `Payment Methods (${paymentMethodsSummary.length})` },
                    { id: "staff", label: `Staff Performance (${staffPerformance.length})` },
                    { id: "voids", label: `Voids & Discounts (${voidDetails.length + cancelledBillsCount})` },
                    { id: "reconciliation", label: "Cash Reconciliation" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? "bg-licorice text-isabelline shadow-sm"
                                : "bg-white text-feldgrau hover:text-licorice ring-1 ring-licorice/5 hover:bg-isabelline"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════
               TAB CONTENT
               ═══════════════════════════════════════════════════════════ */}
            {loading && payments.length === 0 ? (
                <div className="py-20 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-khaki border-t-transparent" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-feldgrau">
                        Calculating shift summary & aggregating receipts…
                    </p>
                </div>
            ) : error ? (
                <div className="rounded-[1.5rem] bg-dark-red/5 p-8 text-center ring-1 ring-dark-red/20 my-6">
                    <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-dark-red" />
                    <p className="mt-2 text-sm font-bold text-dark-red">{error}</p>
                    <button
                        type="button"
                        onClick={loadShiftData}
                        className="mt-4 rounded-full bg-licorice px-4 py-2 text-xs font-bold text-isabelline hover:bg-licorice/90"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <div className="space-y-6 pt-4">
                    {/* ──────────────────────────────────────────────────
                       TAB 1: OVERVIEW & EXECUTIVE STATS
                       ────────────────────────────────────────────────── */}
                    {activeTab === "overview" && (
                        <div className="space-y-6">
                            {/* KPI Hero Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Gross Revenue */}
                                <div className="rounded-[1.5rem] bg-licorice text-isabelline p-5 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-isabelline/60 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wide">Gross Revenue</span>
                                            <BanknotesIcon className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-[26px] md:text-[30px] font-bold tabular-nums tracking-tight">
                                            {formatGHS(totalGrossRevenue)}
                                        </h2>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-isabelline/70">
                                        <span>{successfulPayments.length} transactions</span>
                                        <span>Net: {formatGHS(totalSubtotal)}</span>
                                    </div>
                                </div>

                                {/* Orders & Fulfillment */}
                                <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-feldgrau mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wide">Orders Taken</span>
                                            <ShoppingCartIcon className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-[26px] md:text-[30px] font-bold tabular-nums text-licorice tracking-tight">
                                            {ordersTakenCount}
                                        </h2>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-isabelline flex items-center justify-between text-xs font-medium text-feldgrau">
                                        <span className="text-emerald-700 font-semibold">{fulfilledOrdersCount} served</span>
                                        {cancelledOrdersCount > 0 && (
                                            <span className="text-dark-red font-semibold">{cancelledOrdersCount} cancelled</span>
                                        )}
                                    </div>
                                </div>

                                {/* Average Order Value */}
                                <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-feldgrau mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wide">Avg Ticket Size</span>
                                            <CheckBadgeIcon className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-[26px] md:text-[30px] font-bold tabular-nums text-licorice tracking-tight">
                                            {formatGHS(avgOrderValue)}
                                        </h2>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-isabelline flex items-center justify-between text-xs font-medium text-feldgrau">
                                        <span>Avg / Guest</span>
                                        <span className="font-bold text-licorice">{formatGHS(avgGuestSpend)}</span>
                                    </div>
                                </div>

                                {/* Guests & Cash in Drawer */}
                                <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-feldgrau mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wide">Guests Served</span>
                                            <UserGroupIcon className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-[26px] md:text-[30px] font-bold tabular-nums text-licorice tracking-tight">
                                            {guestsServed}
                                        </h2>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-isabelline flex items-center justify-between text-xs font-medium text-feldgrau">
                                        <span>Cash collected</span>
                                        <span className="font-bold text-emerald-800">{formatGHS(cashCollected)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Grid: Revenue Breakdown Preview + Top Waiters Preview */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Payment Method Preview Card */}
                                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-base text-licorice">Payment Methods</h3>
                                            <p className="text-xs text-feldgrau">Cash vs Card vs Mobile Money</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("payments")}
                                            className="text-xs font-bold text-khaki hover:underline"
                                        >
                                            View Details &rarr;
                                        </button>
                                    </div>

                                    {paymentMethodsSummary.length === 0 ? (
                                        <div className="py-10 text-center text-xs text-feldgrau">No payments recorded in this window.</div>
                                    ) : (
                                        <div className="space-y-3.5">
                                            {paymentMethodsSummary.map((item) => (
                                                <div key={item.method} className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-bold text-licorice flex items-center gap-2">
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: item.color }}
                                                            />
                                                            {item.label}
                                                        </span>
                                                        <span className="font-semibold tabular-nums text-licorice">
                                                            {formatGHS(item.amount)} ({item.pct}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full rounded-full bg-isabelline overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-6 pt-3 border-t border-isabelline flex items-center justify-between text-xs">
                                        <span className="text-feldgrau font-semibold">Digital vs Cash</span>
                                        <span className="font-bold text-licorice">
                                            Digital: {formatGHS(digitalCollected)} &middot; Cash: {formatGHS(cashCollected)}
                                        </span>
                                    </div>
                                </div>

                                {/* Top Performing Waiters Preview */}
                                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-base text-licorice">Top Floor Staff</h3>
                                            <p className="text-xs text-feldgrau">Ranked by orders taken & sales</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("staff")}
                                            className="text-xs font-bold text-khaki hover:underline"
                                        >
                                            Full Leaderboard &rarr;
                                        </button>
                                    </div>

                                    {staffPerformance.length === 0 ? (
                                        <div className="py-10 text-center text-xs text-feldgrau">No staff activity in this window.</div>
                                    ) : (
                                        <div className="divide-y divide-isabelline">
                                            {staffPerformance.slice(0, 4).map((staff, idx) => (
                                                <div key={staff.staffId} className="py-2.5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-isabelline text-xs font-bold text-licorice">
                                                            #{idx + 1}
                                                        </span>
                                                        <div>
                                                            <p className="text-xs font-bold text-licorice">{staff.name}</p>
                                                            <p className="text-[11px] text-feldgrau">
                                                                {staff.ordersCount} orders &middot; {staff.tablesServed} tables
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-licorice tabular-nums">
                                                            {formatGHS(staff.totalSales)}
                                                        </p>
                                                        <p className="text-[11px] text-feldgrau">
                                                            Avg {formatGHS(staff.avgOrderValue)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 pt-3 border-t border-isabelline flex items-center justify-between text-xs">
                                        <span className="text-feldgrau font-semibold">Active Floor Team</span>
                                        <span className="font-bold text-licorice">
                                            {staffPerformance.filter((s) => s.ordersCount > 0).length} active staff members
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tax & Financial Reconciliation Breakdown Table */}
                            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                                <h3 className="font-bold text-base text-licorice mb-3">Shift Financial Breakdown</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                    <div className="rounded-xl bg-isabelline p-3.5">
                                        <p className="text-feldgrau font-semibold uppercase text-[10px]">Net Sales</p>
                                        <p className="mt-1 text-base font-bold tabular-nums text-licorice">{formatGHS(totalSubtotal)}</p>
                                    </div>
                                    <div className="rounded-xl bg-isabelline p-3.5">
                                        <p className="text-feldgrau font-semibold uppercase text-[10px]">Service Charge (8%)</p>
                                        <p className="mt-1 text-base font-bold tabular-nums text-licorice">{formatGHS(totalServiceCharge)}</p>
                                    </div>
                                    <div className="rounded-xl bg-isabelline p-3.5">
                                        <p className="text-feldgrau font-semibold uppercase text-[10px]">VAT / Taxes</p>
                                        <p className="mt-1 text-base font-bold tabular-nums text-licorice">{formatGHS(totalVat)}</p>
                                    </div>
                                    <div className="rounded-xl bg-isabelline p-3.5">
                                        <p className="text-feldgrau font-semibold uppercase text-[10px]">Bysen Fees Owed</p>
                                        <p className="mt-1 text-base font-bold tabular-nums text-dark-red">{formatGHS(totalPlatformFees)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────
                       TAB 2: PAYMENT METHODS BREAKDOWN
                       ────────────────────────────────────────────────── */}
                    {activeTab === "payments" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Pie Chart Visualization */}
                                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col items-center justify-center">
                                    <h3 className="text-sm font-bold text-licorice self-start mb-2">Revenue Share</h3>
                                    <div className="h-[220px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={paymentMethodsSummary}
                                                    dataKey="amount"
                                                    nameKey="label"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={85}
                                                    paddingAngle={4}
                                                >
                                                    {paymentMethodsSummary.map((entry) => (
                                                        <Cell key={entry.method} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(val) => [formatGHS(Number(val)), "Revenue"]}
                                                    contentStyle={{
                                                        borderRadius: "12px",
                                                        border: "none",
                                                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                                                        fontSize: "11px",
                                                        fontWeight: "600",
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
                                        {paymentMethodsSummary.map((item) => (
                                            <div key={item.method} className="flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-feldgrau font-semibold">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Itemized Methods Table */}
                                <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                                    <h3 className="text-sm font-bold text-licorice mb-4">Payment Method Breakdown</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-isabelline text-feldgrau uppercase font-bold text-[11px]">
                                                    <th className="pb-3">Payment Method</th>
                                                    <th className="pb-3 text-center">Tx Count</th>
                                                    <th className="pb-3 text-right">Gross Total</th>
                                                    <th className="pb-3 text-right">Share</th>
                                                    <th className="pb-3 text-right">Platform Fee</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-isabelline/60 font-medium text-slate-700">
                                                {paymentMethodsSummary.map((p) => (
                                                    <tr key={p.method} className="hover:bg-isabelline/40 transition-colors">
                                                        <td className="py-3 flex items-center gap-2">
                                                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-isabelline text-licorice">
                                                                {p.method === "cash" && <BanknotesIcon className="h-4 w-4" />}
                                                                {p.method === "card" && <CreditCardIcon className="h-4 w-4" />}
                                                                {p.method === "mobile_money" && <DevicePhoneMobileIcon className="h-4 w-4" />}
                                                                {p.method !== "cash" && p.method !== "card" && p.method !== "mobile_money" && (
                                                                    <BanknotesIcon className="h-4 w-4" />
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-licorice">{p.label}</span>
                                                        </td>
                                                        <td className="py-3 text-center tabular-nums">{p.count}</td>
                                                        <td className="py-3 text-right font-bold text-licorice tabular-nums">
                                                            {formatGHS(p.amount)}
                                                        </td>
                                                        <td className="py-3 text-right tabular-nums font-semibold">{p.pct}%</td>
                                                        <td className="py-3 text-right tabular-nums text-feldgrau">
                                                            {formatGHS(p.platform_fee)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-licorice/10 font-bold text-licorice">
                                                    <td className="pt-3.5">Total</td>
                                                    <td className="pt-3.5 text-center tabular-nums">{successfulPayments.length}</td>
                                                    <td className="pt-3.5 text-right tabular-nums text-sm">{formatGHS(totalGrossRevenue)}</td>
                                                    <td className="pt-3.5 text-right">100%</td>
                                                    <td className="pt-3.5 text-right tabular-nums">{formatGHS(totalPlatformFees)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────
                       TAB 3: STAFF & WAITER PERFORMANCE
                       ────────────────────────────────────────────────── */}
                    {activeTab === "staff" && (
                        <div className="space-y-6">
                            {/* Performance Cards Highlight */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {staffPerformance[0] && (
                                    <div className="rounded-[1.5rem] bg-khaki/10 p-5 ring-1 ring-khaki/30">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-khaki">
                                            👑 Top Revenue Earner
                                        </span>
                                        <p className="mt-1 text-lg font-black text-licorice">{staffPerformance[0].name}</p>
                                        <p className="mt-2 text-2xl font-bold tabular-nums text-licorice">
                                            {formatGHS(staffPerformance[0].totalSales)}
                                        </p>
                                        <p className="text-xs text-feldgrau mt-0.5">
                                            {staffPerformance[0].ordersCount} orders &middot; {staffPerformance[0].tablesServed} tables
                                        </p>
                                    </div>
                                )}

                                {(() => {
                                    const mostOrdersStaff = [...staffPerformance].sort((a, b) => b.ordersCount - a.ordersCount)[0];
                                    return mostOrdersStaff ? (
                                        <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-licorice/5 shadow-sm">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-feldgrau">
                                                ⚡ Most Orders Taken
                                            </span>
                                            <p className="mt-1 text-lg font-black text-licorice">{mostOrdersStaff.name}</p>
                                            <p className="mt-2 text-2xl font-bold tabular-nums text-licorice">
                                                {mostOrdersStaff.ordersCount} <span className="text-sm font-normal text-feldgrau">orders</span>
                                            </p>
                                            <p className="text-xs text-feldgrau mt-0.5">
                                                {mostOrdersStaff.itemsCount} total items sold
                                            </p>
                                        </div>
                                    ) : null;
                                })()}

                                {(() => {
                                    const highestAovStaff = [...staffPerformance]
                                        .filter((s) => s.ordersCount >= 2)
                                        .sort((a, b) => b.avgOrderValue - a.avgOrderValue)[0];
                                    return highestAovStaff ? (
                                        <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-licorice/5 shadow-sm">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-feldgrau">
                                                🎯 Highest Avg Ticket
                                            </span>
                                            <p className="mt-1 text-lg font-black text-licorice">{highestAovStaff.name}</p>
                                            <p className="mt-2 text-2xl font-bold tabular-nums text-licorice">
                                                {formatGHS(highestAovStaff.avgOrderValue)}
                                            </p>
                                            <p className="text-xs text-feldgrau mt-0.5">Average ticket per order</p>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Full Waiter Performance Table */}
                            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-licorice">Floor Staff Metrics</h3>
                                    <span className="text-xs text-feldgrau">{staffPerformance.length} staff records</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs min-w-[650px]">
                                        <thead>
                                            <tr className="border-b border-isabelline text-feldgrau uppercase font-bold text-[11px]">
                                                <th className="pb-3">Staff Member</th>
                                                <th className="pb-3">Role</th>
                                                <th className="pb-3 text-center">Orders</th>
                                                <th className="pb-3 text-center">Items Sold</th>
                                                <th className="pb-3 text-center">Tables / Guests</th>
                                                <th className="pb-3 text-right">Avg Order</th>
                                                <th className="pb-3 text-right">Total Sales</th>
                                                <th className="pb-3 text-center">Void Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-isabelline/60 font-medium text-slate-700">
                                            {staffPerformance.map((s, idx) => (
                                                <tr key={s.staffId} className="hover:bg-isabelline/40 transition-colors">
                                                    <td className="py-3 flex items-center gap-2.5">
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-isabelline font-bold text-licorice">
                                                            {s.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-licorice flex items-center gap-1.5">
                                                                {s.name}
                                                                {idx === 0 && <span className="text-xs">🏆</span>}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <span className="rounded-md bg-isabelline px-2 py-0.5 text-[11px] font-bold text-feldgrau uppercase">
                                                            {s.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-center tabular-nums font-bold text-licorice">
                                                        {s.ordersCount}
                                                    </td>
                                                    <td className="py-3 text-center tabular-nums">{s.itemsCount}</td>
                                                    <td className="py-3 text-center tabular-nums">
                                                        {s.tablesServed} tbls &middot; {s.guestsServed} guests
                                                    </td>
                                                    <td className="py-3 text-right tabular-nums font-semibold">
                                                        {formatGHS(s.avgOrderValue)}
                                                    </td>
                                                    <td className="py-3 text-right tabular-nums font-bold text-licorice text-[13px]">
                                                        {formatGHS(s.totalSales)}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {s.cancelledCount > 0 ? (
                                                            <span className="rounded-full bg-dark-red/10 px-2 py-0.5 text-[11px] font-bold text-dark-red">
                                                                {s.cancelledCount} ({formatGHS(s.cancelledValue)})
                                                            </span>
                                                        ) : (
                                                            <span className="text-feldgrau font-semibold">0%</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────
                       TAB 4: VOIDS, CANCELLATIONS & DISCOUNTS
                       ────────────────────────────────────────────────── */}
                    {activeTab === "voids" && (
                        <div className="space-y-6">
                            {/* Summary Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="rounded-[1.5rem] bg-dark-red/5 p-5 ring-1 ring-dark-red/20">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-dark-red">
                                        Lost Revenue (Voids &amp; Cancels)
                                    </span>
                                    <p className="mt-2 text-2xl font-bold tabular-nums text-dark-red">
                                        {formatGHS(totalVoidLostRevenue)}
                                    </p>
                                    <p className="text-xs text-feldgrau mt-0.5">
                                        {voidDetails.length} cancelled items &middot; {cancelledBillsCount} cancelled bills
                                    </p>
                                </div>

                                <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-licorice/5 shadow-sm">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-feldgrau">
                                        Discounts &amp; Comps Applied
                                    </span>
                                    <p className="mt-2 text-2xl font-bold tabular-nums text-licorice">
                                        {formatGHS(totalDiscountsValue)}
                                    </p>
                                    <p className="text-xs text-feldgrau mt-0.5">Bill adjustments &amp; promos</p>
                                </div>

                                <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-licorice/5 shadow-sm">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-feldgrau">
                                        Void Rate Percentage
                                    </span>
                                    <p className="mt-2 text-2xl font-bold tabular-nums text-licorice">
                                        {totalGrossRevenue > 0
                                            ? ((totalVoidLostRevenue / (totalGrossRevenue + totalVoidLostRevenue)) * 100).toFixed(1)
                                            : 0}
                                        %
                                    </p>
                                    <p className="text-xs text-feldgrau mt-0.5">Of total potential shift volume</p>
                                </div>
                            </div>

                            {/* Itemized Void & Cancellation Log */}
                            <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5">
                                <h3 className="text-sm font-bold text-licorice mb-4">Itemized Voids &amp; Cancellations Log</h3>

                                {voidDetails.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <CheckBadgeIcon className="mx-auto h-8 w-8 text-emerald-600" />
                                        <p className="mt-2 text-sm font-bold text-licorice">No voided or cancelled items</p>
                                        <p className="text-xs text-feldgrau">All orders during this shift were served normally.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs min-w-[600px]">
                                            <thead>
                                                <tr className="border-b border-isabelline text-feldgrau uppercase font-bold text-[11px]">
                                                    <th className="pb-3">Item Name</th>
                                                    <th className="pb-3">Qty</th>
                                                    <th className="pb-3">Table / Guest</th>
                                                    <th className="pb-3">Staff</th>
                                                    <th className="pb-3 text-right">Lost Amount</th>
                                                    <th className="pb-3 text-right">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-isabelline/60 font-medium text-slate-700">
                                                {voidDetails.map((v, i) => (
                                                    <tr key={`${v.id}-${i}`} className="hover:bg-isabelline/40 transition-colors">
                                                        <td className="py-3">
                                                            <p className="font-bold text-licorice">{v.productName}</p>
                                                            {v.notes && <p className="text-[11px] text-dark-red italic">"{v.notes}"</p>}
                                                        </td>
                                                        <td className="py-3 tabular-nums font-bold">{v.quantity}x</td>
                                                        <td className="py-3">
                                                            <p className="font-semibold text-licorice">{v.tableName}</p>
                                                            <p className="text-[11px] text-feldgrau">{v.guestName}</p>
                                                        </td>
                                                        <td className="py-3 text-feldgrau">{v.waiterName}</td>
                                                        <td className="py-3 text-right font-bold text-dark-red tabular-nums">
                                                            {formatGHS(v.lineTotal)}
                                                        </td>
                                                        <td className="py-3 text-right tabular-nums text-feldgrau">{v.time}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────
                       TAB 5: CASH DRAWER RECONCILIATION
                       ────────────────────────────────────────────────── */}
                    {activeTab === "reconciliation" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Cash Drawer Balancing Box */}
                                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 space-y-4">
                                    <div>
                                        <h3 className="text-base font-bold text-licorice">Cash Drawer Balancing</h3>
                                        <p className="text-xs text-feldgrau">Reconcile physical cash counted vs system records</p>
                                    </div>

                                    <div className="space-y-3 text-xs">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-isabelline">
                                            <span className="font-semibold text-feldgrau">Opening Starting Float</span>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-licorice">GH₵</span>
                                                <input
                                                    type="number"
                                                    value={startingFloat}
                                                    onChange={(e) => setStartingFloat(parseFloat(e.target.value) || 0)}
                                                    className="w-20 rounded-md bg-white px-2 py-1 text-right font-bold text-licorice ring-1 ring-licorice/10"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-xl bg-isabelline">
                                            <span className="font-semibold text-feldgrau">(+) Cash Sales Collected</span>
                                            <span className="font-bold text-emerald-700 tabular-nums">+{formatGHS(cashCollected)}</span>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-xl bg-isabelline">
                                            <span className="font-semibold text-feldgrau">(-) Cash Refunds / Paid Outs</span>
                                            <span className="font-bold text-feldgrau tabular-nums">-GH₵0.00</span>
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-xl bg-licorice text-isabelline">
                                            <span className="font-bold uppercase tracking-wider text-xs">Expected Cash In Drawer</span>
                                            <span className="text-lg font-bold tabular-nums">{formatGHS(expectedCashInDrawer)}</span>
                                        </div>
                                    </div>

                                    {/* Counted Cash Input */}
                                    <div className="pt-2 border-t border-isabelline space-y-3">
                                        <label className="block text-xs font-bold uppercase text-feldgrau">
                                            Actual Counted Cash at End of Shift:
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-licorice">GH₵</span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={countedCash}
                                                onChange={(e) => setCountedCash(e.target.value)}
                                                className="flex-1 rounded-xl ring-1 ring-licorice/20 bg-white px-4 py-2.5 text-lg font-bold text-licorice placeholder:text-feldgrau/40 focus:ring-2 focus:ring-licorice outline-none tabular-nums"
                                            />
                                        </div>

                                        {countedCashNumber !== null && (
                                            <div
                                                className={`p-4 rounded-xl flex items-center justify-between text-xs font-bold ${
                                                    Math.abs(cashVariance) < 0.01
                                                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                                        : cashVariance > 0
                                                        ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                                                        : "bg-dark-red/10 text-dark-red ring-1 ring-dark-red/20"
                                                }`}
                                            >
                                                <span>
                                                    {Math.abs(cashVariance) < 0.01
                                                        ? "✅ Drawer Perfectly Balanced"
                                                        : cashVariance > 0
                                                        ? "📈 Drawer Cash Over (+)"
                                                        : "⚠️ Drawer Cash Short (-)"}
                                                </span>
                                                <span className="text-sm tabular-nums font-black">
                                                    {cashVariance > 0 ? "+" : ""}
                                                    {formatGHS(cashVariance)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Shift Closing Checklist */}
                                <div className="rounded-[1.5rem] bg-white p-5 md:p-6 shadow-sm ring-1 ring-licorice/5 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <h3 className="text-base font-bold text-licorice">Shift Sign-Off Checklist</h3>
                                        <div className="space-y-2.5 text-xs text-slate-700">
                                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-isabelline/50 transition-colors cursor-pointer">
                                                <input type="checkbox" defaultChecked className="rounded text-licorice focus:ring-licorice" />
                                                <span>All open tables have been settled or transferred</span>
                                            </label>
                                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-isabelline/50 transition-colors cursor-pointer">
                                                <input type="checkbox" defaultChecked className="rounded text-licorice focus:ring-licorice" />
                                                <span>Card POS terminal batch has been closed &amp; printed</span>
                                            </label>
                                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-isabelline/50 transition-colors cursor-pointer">
                                                <input type="checkbox" defaultChecked className="rounded text-licorice focus:ring-licorice" />
                                                <span>Physical cash counted and verified against ledger</span>
                                            </label>
                                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-isabelline/50 transition-colors cursor-pointer">
                                                <input type="checkbox" defaultChecked className="rounded text-licorice focus:ring-licorice" />
                                                <span>Void and discount manager authorization reviewed</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-isabelline flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handlePrint}
                                            className="flex-1 rounded-full bg-licorice text-isabelline py-2.5 text-xs font-bold shadow-md hover:bg-licorice/90 transition-all text-center"
                                        >
                                            Print Shift Sign-Off
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
