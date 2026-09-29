import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BanknotesIcon,
    CalendarIcon,
    CheckBadgeIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PrinterIcon,
    ArrowPathIcon,
    ShoppingBagIcon,
    UserIcon,
    XCircleIcon,
    XMarkIcon,
    SparklesIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    InformationCircleIcon
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import { useRealtime } from "../../hooks/useRealtime";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type ShiftFilterRange = "CURRENT" | "TODAY" | "YESTERDAY" | "LAST_7D" | "THIS_MONTH" | "CUSTOM";

export type PaymentCategory = "ALL" | "CASH" | "DIGITAL" | "UNSETTLED" | "CANCELLED";

export type FlatOrderItem = {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    status: string;
    notes?: string | null;
};

export type ShiftOrderTransaction = {
    id: string;
    billId: string | null;
    createdAt: string;
    guestName: string;
    status: string;
    notes: string | null;
    tableId: string | null;
    tableLabel: string;
    waiterId: string | null;
    waiterName: string;
    waiterRole: string;
    items: FlatOrderItem[];
    itemCount: number;
    totalAmount: number;
    paymentMethod: string; // 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'none'
    closureType: "CASH" | "DIGITAL" | "UNSETTLED" | "CANCELLED";
    billStatus: string; // 'open' | 'closed' | 'paid'
    payments: { amount: number; method: string; created_at: string }[];
};

export type WaiterShiftSummary = {
    staffId: string;
    name: string;
    role: string;
    isActive: boolean;
    ordersCount: number;
    itemsCount: number;
    totalSales: number;
    avgOrderValue: number;
    cashCollected: number;
    digitalCollected: number;
    tablesServed: Set<string>;
    openBillsCount: number;
    closedBillsCount: number;
    isFullyClosed: boolean;
};

type Props = {
    venueId?: string;
    isModal?: boolean;
    onClose?: () => void;
};

/* ═══════════════════════════════════════════════════════════════════════════
   CALENDAR POPOVER COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

type CalendarPickerProps = {
    range: ShiftFilterRange;
    customStart: string;
    customEnd: string;
    onSelectPreset: (preset: ShiftFilterRange) => void;
    onSelectCustomRange: (start: string, end: string) => void;
    rangeLabel: string;
    transactionDates?: Set<string>;
    workingDays: number[];
    onToggleWorkingDay: (dayIdx: number) => void;
};

function ShiftCalendarPicker({
    range,
    customStart,
    customEnd,
    onSelectPreset,
    onSelectCustomRange,
    rangeLabel,
    transactionDates = new Set(),
    workingDays,
    onToggleWorkingDay,
}: CalendarPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Current displayed calendar month
    const [viewDate, setViewDate] = useState<Date>(() => {
        if (customStart) {
            const parsed = new Date(`${customStart}T00:00:00`);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    });

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const prevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const prevM = month === 0 ? 11 : month - 1;
        const prevY = month === 0 ? year - 1 : year;
        const mStr = String(prevM + 1).padStart(2, "0");
        const dStr = String(d).padStart(2, "0");
        calendarCells.push({
            dateStr: `${prevY}-${mStr}-${dStr}`,
            dayNum: d,
            isCurrentMonth: false,
        });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const mStr = String(month + 1).padStart(2, "0");
        const dStr = String(d).padStart(2, "0");
        calendarCells.push({
            dateStr: `${year}-${mStr}-${dStr}`,
            dayNum: d,
            isCurrentMonth: true,
        });
    }

    // Next month padding
    const totalCellsSoFar = calendarCells.length;
    const totalGridSize = totalCellsSoFar > 35 ? 42 : 35;
    for (let d = 1; d <= totalGridSize - totalCellsSoFar; d++) {
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        const mStr = String(nextM + 1).padStart(2, "0");
        const dStr = String(d).padStart(2, "0");
        calendarCells.push({
            dateStr: `${nextY}-${mStr}-${dStr}`,
            dayNum: d,
            isCurrentMonth: false,
        });
    }

    const handleDayClick = (dateStr: string) => {
        if (range !== "CUSTOM") {
            onSelectCustomRange(dateStr, dateStr);
        } else if (!customStart || (customStart && customEnd)) {
            onSelectCustomRange(dateStr, "");
        } else if (customStart && !customEnd) {
            if (dateStr < customStart) {
                onSelectCustomRange(dateStr, customStart);
            } else {
                onSelectCustomRange(customStart, dateStr);
            }
        }
    };

    const isDateSelected = (dateStr: string) => {
        if (range !== "CUSTOM") return false;
        if (customStart && !customEnd) return dateStr === customStart;
        if (customStart && customEnd) {
            return dateStr >= customStart && dateStr <= customEnd;
        }
        return false;
    };

    const isStartOrEnd = (dateStr: string) => {
        if (range !== "CUSTOM") return false;
        return dateStr === customStart || dateStr === customEnd;
    };

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const todayStr = new Date().toISOString().split("T")[0];

    return (
        <div className="relative inline-block" ref={popoverRef}>
            {/* Trigger Pill */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#1A110B]/15 px-3.5 py-2 shadow-sm text-xs font-bold text-[#1A110B] hover:bg-[#1A110B]/5 transition cursor-pointer"
            >
                <CalendarIcon className="h-4 w-4 text-[#1A110B]" />
                <span>{rangeLabel}</span>
                <ChevronRightIcon className={`h-3.5 w-3.5 text-[#606F69] transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`} />
            </button>

            {/* Calendar Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 z-50 w-84 rounded-2xl bg-white p-4 shadow-2xl border border-[#1A110B]/15 text-[#1A110B] animate-in fade-in zoom-in-95">
                    {/* Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-[#1A110B]/10">
                        <button
                            type="button"
                            onClick={() => {
                                onSelectPreset("CURRENT");
                                setIsOpen(false);
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                                range === "CURRENT" ? "bg-[#1A110B] text-white" : "bg-[#1A110B]/5 text-[#1A110B] hover:bg-[#1A110B]/10"
                            }`}
                        >
                            Tonight
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onSelectPreset("YESTERDAY");
                                setIsOpen(false);
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                                range === "YESTERDAY" ? "bg-[#1A110B] text-white" : "bg-[#1A110B]/5 text-[#1A110B] hover:bg-[#1A110B]/10"
                            }`}
                        >
                            Yesterday
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onSelectPreset("LAST_7D");
                                setIsOpen(false);
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                                range === "LAST_7D" ? "bg-[#1A110B] text-white" : "bg-[#1A110B]/5 text-[#1A110B] hover:bg-[#1A110B]/10"
                            }`}
                        >
                            Last 7 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onSelectPreset("THIS_MONTH");
                                setIsOpen(false);
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                                range === "THIS_MONTH" ? "bg-[#1A110B] text-white" : "bg-[#1A110B]/5 text-[#1A110B] hover:bg-[#1A110B]/10"
                            }`}
                        >
                            This Month
                        </button>
                    </div>

                    {/* Working Days Selector Bar */}
                    <div className="py-2.5 px-1 border-b border-[#1A110B]/10 flex items-center justify-between text-xs">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[#606F69]">
                            Working Days:
                        </span>
                        <div className="flex items-center gap-1">
                            {["S", "M", "T", "W", "T", "F", "S"].map((dayLetter, idx) => {
                                const isWorking = workingDays.includes(idx);
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => onToggleWorkingDay(idx)}
                                        className={`h-6 w-6 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                            isWorking
                                                ? "bg-[#23140C] text-white shadow-xs"
                                                : "bg-[#1A110B]/5 text-[#606F69] hover:bg-[#1A110B]/15"
                                        }`}
                                        title={`Toggle ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][idx]} as working day`}
                                    >
                                        {dayLetter}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Month Controls */}
                    <div className="flex items-center justify-between py-2.5">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="rounded-lg p-1 hover:bg-[#1A110B]/5 transition text-[#1A110B] cursor-pointer"
                        >
                            <ChevronLeftIcon className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-black uppercase tracking-wider text-[#1A110B]">
                            {monthNames[month]} {year}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="rounded-lg p-1 hover:bg-[#1A110B]/5 transition text-[#1A110B] cursor-pointer"
                        >
                            <ChevronRightIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Weekday Names */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-[#606F69] mb-1">
                        <span>Su</span>
                        <span>Mo</span>
                        <span>Tu</span>
                        <span>We</span>
                        <span>Th</span>
                        <span>Fr</span>
                        <span>Sa</span>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center text-xs font-semibold justify-items-center">
                        {calendarCells.map((cell, idx) => {
                            const selected = isDateSelected(cell.dateStr);
                            const endpoint = isStartOrEnd(cell.dateStr);
                            const isToday = cell.dateStr === todayStr;

                            // Calculate weekday of this cell date
                            const cellDate = new Date(`${cell.dateStr}T00:00:00`);
                            const weekdayIdx = cellDate.getDay();
                            const isWorkingDay = workingDays.includes(weekdayIdx);
                            const hasTransaction = transactionDates.has(cell.dateStr);

                            let cellStyle = "";

                            // Base status styling (Transaction vs Working Day vs Plain Day)
                            if (hasTransaction) {
                                // Day WITH recorded transaction -> Solid brown fill circle
                                cellStyle = cell.isCurrentMonth
                                    ? "bg-[#23140C] text-white shadow-xs font-black hover:bg-[#23140C]/90"
                                    : "bg-[#23140C]/50 text-white/70 font-bold";
                            } else if (isWorkingDay && cell.isCurrentMonth) {
                                // Working day WITHOUT recorded transaction -> ONLY brown outline circle (no activity)
                                cellStyle = "border-2 border-[#23140C] text-[#23140C] bg-transparent hover:bg-[#23140C]/10 font-bold";
                            } else if (!cell.isCurrentMonth) {
                                cellStyle = "text-[#1A110B]/25 hover:bg-[#1A110B]/5";
                            } else {
                                cellStyle = "text-[#1A110B]/50 hover:bg-[#1A110B]/10";
                            }

                            // Active Filter Selection Highlight (separated from transaction fill)
                            if (endpoint) {
                                cellStyle += " ring-2 ring-amber-500 ring-offset-1";
                                if (!hasTransaction && !isWorkingDay) {
                                    cellStyle += " bg-amber-500/20 text-[#1A110B] font-extrabold";
                                }
                            } else if (selected) {
                                cellStyle += " ring-1 ring-amber-400/60 bg-amber-500/10";
                            }

                            if (isToday && !endpoint) {
                                cellStyle += " underline decoration-amber-600 underline-offset-2";
                            }

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleDayClick(cell.dateStr)}
                                    className={`relative h-9 w-9 aspect-square rounded-full flex items-center justify-center transition text-xs cursor-pointer ${cellStyle}`}
                                    title={`${cell.dateStr}${
                                        hasTransaction
                                            ? " · Sales Recorded"
                                            : isWorkingDay
                                            ? " · Working Day (No Activity)"
                                            : ""
                                    }`}
                                >
                                    <span className="leading-none">{cell.dayNum}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Date Summary & Legend Footer */}
                    <div className="mt-3 pt-2.5 border-t border-[#1A110B]/10 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] text-[#606F69]">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5" title="Recorded sales on this day">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#23140C]" /> Sales Recorded
                                </span>
                                <span className="flex items-center gap-1.5" title="Working day with no sales activity">
                                    <span className="h-2.5 w-2.5 rounded-full border-2 border-[#23140C] bg-transparent" /> No Activity
                                </span>
                            </div>
                            <span className="font-semibold text-[#1A110B]">
                                {range === "CUSTOM" && customStart ? customStart : "Click dates"}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="w-full rounded-lg bg-[#1A110B] py-1.5 text-xs font-bold text-white hover:bg-[#1A110B]/90 transition cursor-pointer"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function ShiftReportScreen({ venueId, isModal = false, onClose }: Props) {
    const { venue } = useVenue(venueId);

    // Filters
    const [range, setRange] = useState<ShiftFilterRange>("CURRENT");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [selectedWaiterId, setSelectedWaiterId] = useState<string>("ALL");
    const [paymentFilter, setPaymentFilter] = useState<PaymentCategory>("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Combined Filter Popover State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterPopoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
                setIsFilterOpen(false);
            }
        }
        if (isFilterOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isFilterOpen]);

    // Working Days Setting (persisted in localStorage)
    const [workingDays, setWorkingDays] = useState<number[]>(() => {
        try {
            const saved = localStorage.getItem("nightos_working_days");
            return saved ? JSON.parse(saved) : [0, 3, 4, 5, 6]; // Default: Sun, Wed, Thu, Fri, Sat
        } catch {
            return [0, 3, 4, 5, 6];
        }
    });

    const toggleWorkingDay = (dayIdx: number) => {
        const updated = workingDays.includes(dayIdx)
            ? workingDays.filter((d) => d !== dayIdx)
            : [...workingDays, dayIdx];
        setWorkingDays(updated);
        try {
            localStorage.setItem("nightos_working_days", JSON.stringify(updated));
        } catch (err) {
            console.error("Failed to save working days setting:", err);
        }
    };

    // Active View Tab
    const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "WAITERS" | "RECONCILIATION">("TRANSACTIONS");

    // Drawer / Modal Inspector
    const [selectedTransaction, setSelectedTransaction] = useState<ShiftOrderTransaction | null>(null);

    // Loading & Raw Data State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [payments, setPayments] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    // Cash Drawer Reconciliation Inputs
    const [startingFloat, setStartingFloat] = useState<number>(200);
    const [countedCash, setCountedCash] = useState<string>("");

    // Stable Time Window
    const { sinceIso, untilIso, rangeLabel } = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        if (range === "CURRENT" || range === "TODAY") {
            return {
                sinceIso: startOfToday.toISOString(),
                untilIso: undefined,
                rangeLabel: range === "CURRENT" ? "Tonight's Shift" : "Full Day Today",
            };
        }

        if (range === "YESTERDAY") {
            const yStart = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
            const yEnd = new Date(startOfToday.getTime() - 1);
            return {
                sinceIso: yStart.toISOString(),
                untilIso: yEnd.toISOString(),
                rangeLabel: `Yesterday (${yStart.toLocaleDateString([], { month: "short", day: "numeric" })})`,
            };
        }

        if (range === "LAST_7D") {
            const start7d = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
            return {
                sinceIso: start7d.toISOString(),
                untilIso: undefined,
                rangeLabel: "Last 7 Days",
            };
        }

        if (range === "THIS_MONTH") {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            return {
                sinceIso: monthStart.toISOString(),
                untilIso: undefined,
                rangeLabel: `This Month (${monthStart.toLocaleDateString([], { month: "short", year: "numeric" })})`,
            };
        }

        if (range === "CUSTOM" && customStart) {
            const start = new Date(`${customStart}T00:00:00`);
            const end = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date(`${customStart}T23:59:59`);

            let label = start.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
            if (customEnd && customEnd !== customStart) {
                const endD = new Date(`${customEnd}T00:00:00`);
                label = `${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${endD.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
            }

            return {
                sinceIso: start.toISOString(),
                untilIso: end.toISOString(),
                rangeLabel: label,
            };
        }

        return {
            sinceIso: startOfToday.toISOString(),
            untilIso: undefined,
            rangeLabel: "Tonight's Shift",
        };
    }, [range, customStart, customEnd]);

    // Historical transaction dates across all time for venue
    const [historicalTxDates, setHistoricalTxDates] = useState<Set<string>>(new Set());

    const fetchHistoricalTxDates = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        try {
            const dates = await db.venueTransactionDates(venue.id);
            setHistoricalTxDates(new Set(dates));
        } catch (err) {
            console.error("[ShiftReportScreen] Error fetching historical transaction dates:", err);
        }
    }, [venue.id]);

    useEffect(() => {
        void fetchHistoricalTxDates();
    }, [fetchHistoricalTxDates]);

    // Data Fetcher
    const isFetchingRef = useRef(false);
    const loadShiftData = useCallback(async (showSpinner = true) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000" || isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (showSpinner) setLoading(true);
        setError(null);
        try {
            const res = await db.shiftReportData(venue.id, sinceIso, untilIso);
            if (res.error) throw new Error(res.error);
            setPayments(res.payments || []);
            setBills(res.bills || []);
            setSubmissions(res.submissions || []);
            setStaffList(res.staff || []);
            setShifts(res.shifts || []);
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("[ShiftReportScreen] Error fetching shift data:", err);
            setError(err instanceof Error ? err.message : "Failed to load shift report data.");
        } finally {
            isFetchingRef.current = false;
            if (showSpinner) setLoading(false);
        }
    }, [venue.id, sinceIso, untilIso]);

    useEffect(() => {
        let active = true;
        Promise.resolve().then(() => {
            if (active) void loadShiftData(true);
        });
        return () => {
            active = false;
        };
    }, [loadShiftData]);

    const handleRealtimeUpdate = useCallback(() => {
        loadShiftData(false);
        fetchHistoricalTxDates();
    }, [loadShiftData, fetchHistoricalTxDates]);

    useRealtime({
        table: "payments",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
    });
    useRealtime({
        table: "bills",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
    });
    useRealtime({
        table: "order_submissions",
        filter: venue.id ? `venue_id=eq.${venue.id}` : undefined,
        onInsert: handleRealtimeUpdate,
        onUpdate: handleRealtimeUpdate,
    });

    /* ═══════════════════════════════════════════════════════════════════════════
       PROCESSED DATA COMPUTATIONS
       ═══════════════════════════════════════════════════════════════════════════ */

    // Map Staff by ID
    const staffMap = useMemo(() => {
        const map = new Map<string, any>();
        staffList.forEach((s) => map.set(s.id, s));
        return map;
    }, [staffList]);

    // Build List of Flat Order Transactions linked to Waiters & Table Payment Status
    const rawTransactions = useMemo<ShiftOrderTransaction[]>(() => {
        const paymentByBillMap = new Map<string, any[]>();
        payments.forEach((p) => {
            if (!p.bill_id) return;
            const existing = paymentByBillMap.get(p.bill_id) || [];
            existing.push(p);
            paymentByBillMap.set(p.bill_id, existing);
        });

        const billMap = new Map<string, any>();
        bills.forEach((b) => billMap.set(b.id, b));

        return submissions.map((sub) => {
            const bill = sub.bill_id ? billMap.get(sub.bill_id) || sub.bills : sub.bills;
            const waiterId = bill?.waiter_id || null;
            const staffObj = waiterId ? staffMap.get(waiterId) : null;
            const waiterName = staffObj ? staffObj.name : "House / Direct Bar";
            const waiterRole = staffObj ? staffObj.role : "Staff";

            // Extract table label
            const tablesObj = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
            const tableLabel = tablesObj?.table_label
                ? String(tablesObj.table_label)
                : tablesObj?.table_number
                ? `Table ${tablesObj.table_number}`
                : "Walk-in Zone";
            const tableId = bill?.table_id || null;

            // Extract order items
            const rawItems: any[] = sub.order_items || [];
            const items: FlatOrderItem[] = rawItems.map((it) => ({
                id: it.id,
                productName: it.product_name,
                quantity: Number(it.quantity || 1),
                unitPrice: Number(it.unit_price || 0),
                lineTotal: Number(it.line_total || 0),
                status: it.status || "served",
                notes: it.notes || null,
            }));

            const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
            const totalAmount = items.reduce((acc, i) => acc + i.lineTotal, 0);

            // Determine Payment & Settlement status
            const billPayments = sub.bill_id ? paymentByBillMap.get(sub.bill_id) || [] : [];
            let paymentMethod = "none";
            let closureType: "CASH" | "DIGITAL" | "UNSETTLED" | "CANCELLED" = "UNSETTLED";

            const billStatus = bill?.status || "open";
            const isCancelled = sub.status === "cancelled" || (sub as any).cancelled || billStatus === "cancelled";

            if (isCancelled) {
                closureType = "CANCELLED";
                paymentMethod = "cancelled";
            } else if (billPayments.length > 0) {
                const primaryPayment = billPayments[0];
                paymentMethod = primaryPayment.method || "cash";
                if (paymentMethod === "cash") {
                    closureType = "CASH";
                } else {
                    closureType = "DIGITAL";
                }
            } else if (billStatus === "paid" || billStatus === "closed") {
                // Default fallback if bill marked paid
                closureType = "CASH";
                paymentMethod = "cash";
            }

            return {
                id: sub.id,
                billId: sub.bill_id || null,
                createdAt: sub.created_at,
                guestName: sub.guest_name || "Guest",
                status: sub.status || "served",
                notes: sub.notes || null,
                tableId,
                tableLabel,
                waiterId,
                waiterName,
                waiterRole,
                items,
                itemCount,
                totalAmount,
                paymentMethod,
                closureType,
                billStatus,
                payments: billPayments.map((p) => ({
                    amount: Number(p.amount || 0),
                    method: p.method || "cash",
                    created_at: p.created_at,
                })),
            };
        });
    }, [submissions, bills, payments, staffMap]);

    // Build Waiter Performance & Closure Verification Breakdown
    const waiterSummaries = useMemo<WaiterShiftSummary[]>(() => {
        const summariesMap = new Map<string, WaiterShiftSummary>();

        // Initialize entries for all staff members who had active shifts or are registered staff
        staffList.forEach((s) => {
            summariesMap.set(s.id, {
                staffId: s.id,
                name: s.name,
                role: s.role || "Waiter",
                isActive: s.is_active !== false,
                ordersCount: 0,
                itemsCount: 0,
                totalSales: 0,
                avgOrderValue: 0,
                cashCollected: 0,
                digitalCollected: 0,
                tablesServed: new Set<string>(),
                openBillsCount: 0,
                closedBillsCount: 0,
                isFullyClosed: true,
            });
        });

        // Add "House / Direct Bar" bucket if needed
        summariesMap.set("HOUSE", {
            staffId: "HOUSE",
            name: "House / Direct Bar",
            role: "Station",
            isActive: true,
            ordersCount: 0,
            itemsCount: 0,
            totalSales: 0,
            avgOrderValue: 0,
            cashCollected: 0,
            digitalCollected: 0,
            tablesServed: new Set<string>(),
            openBillsCount: 0,
            closedBillsCount: 0,
            isFullyClosed: true,
        });

        // Track bills per waiter for closure verification
        const waiterBillsMap = new Map<string, Map<string, any>>();
        bills.forEach((b) => {
            const wId = b.waiter_id || "HOUSE";
            let bMap = waiterBillsMap.get(wId);
            if (!bMap) {
                bMap = new Map();
                waiterBillsMap.set(wId, bMap);
            }
            bMap.set(b.id, b);
        });

        // Aggregate orders per waiter (excluding cancelled / voided orders)
        rawTransactions.forEach((tx) => {
            if (tx.closureType === "CANCELLED") return;

            const wId = tx.waiterId || "HOUSE";
            const summary = summariesMap.get(wId);
            if (summary) {
                summary.ordersCount += 1;
                summary.itemsCount += tx.itemCount;
                summary.totalSales += tx.totalAmount;
                if (tx.tableLabel) summary.tablesServed.add(tx.tableLabel);

                if (tx.closureType === "CASH") {
                    summary.cashCollected += tx.totalAmount;
                } else if (tx.closureType === "DIGITAL") {
                    summary.digitalCollected += tx.totalAmount;
                }
            }
        });

        // Calculate bill closure & averages
        summariesMap.forEach((summary, wId) => {
            const bMap = waiterBillsMap.get(wId);
            if (bMap) {
                bMap.forEach((b) => {
                    if (b.status === "paid" || b.status === "closed") {
                        summary.closedBillsCount += 1;
                    } else if (b.status === "open") {
                        summary.openBillsCount += 1;
                    }
                });
            }

            summary.isFullyClosed = summary.openBillsCount === 0;
            summary.avgOrderValue = summary.ordersCount > 0 ? summary.totalSales / summary.ordersCount : 0;
        });

        // Filter out staff with 0 activity unless they have active shifts or are assigned to tables
        return Array.from(summariesMap.values())
            .filter((w) => w.ordersCount > 0 || w.closedBillsCount > 0 || w.openBillsCount > 0)
            .sort((a, b) => b.totalSales - a.totalSales);
    }, [rawTransactions, staffList, bills]);

    // Active Waiters and Managers for Filter (Every account that has not been deactivated)
    const eligibleOrderTakers = useMemo(() => {
        return staffList
            .filter((s) => {
                // Must not be deactivated
                if (s.is_active === false) return false;
                const r = (s.role || "").toLowerCase();
                return r.includes("waiter") || r.includes("manager");
            })
            .map((s) => {
                // Clean up any double role tags like "(Waiter)" in name if already present in DB
                const cleanName = s.name.replace(/\s*\((?:waiter|manager|staff)\)\s*$/gi, "").trim() || s.name;
                const isManager = (s.role || "").toLowerCase().includes("manager");
                const displayName = isManager ? `${cleanName} (Manager)` : cleanName;
                return {
                    id: s.id,
                    name: s.name,
                    displayName,
                    role: s.role || "Staff",
                };
            })
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [staffList]);

    const paymentLabels: Record<PaymentCategory, string> = useMemo(() => ({
        ALL: "All",
        CASH: "Cash Only",
        DIGITAL: "Digital",
        UNSETTLED: "Unsettled",
        CANCELLED: "Cancelled / Void",
    }), []);

    const activeWaiter = useMemo(
        () => eligibleOrderTakers.find((w) => w.id === selectedWaiterId),
        [eligibleOrderTakers, selectedWaiterId]
    );
    const isWaiterFiltered = selectedWaiterId !== "ALL";
    const isPaymentFiltered = paymentFilter !== "ALL";
    const activeFilterCount = (isWaiterFiltered ? 1 : 0) + (isPaymentFiltered ? 1 : 0);
    const hasActiveFilters = activeFilterCount > 0;

    // Filter Transactions based on Waiter/Role, Search, and Payment category
    const filteredTransactions = useMemo(() => {
        return rawTransactions.filter((tx) => {
            // Waiter / Role Filter
            if (selectedWaiterId !== "ALL") {
                if (selectedWaiterId.startsWith("ROLE:")) {
                    const targetRole = selectedWaiterId.replace("ROLE:", "").toLowerCase();
                    const roleStr = (tx.waiterRole || "").toLowerCase();
                    if (!roleStr.includes(targetRole) && targetRole !== roleStr) return false;
                } else if (selectedWaiterId === "HOUSE") {
                    if (tx.waiterId !== null) return false;
                } else {
                    if (tx.waiterId !== selectedWaiterId) return false;
                }
            }

            // Payment Filter
            if (paymentFilter === "CASH" && tx.closureType !== "CASH") return false;
            if (paymentFilter === "DIGITAL" && tx.closureType !== "DIGITAL") return false;
            if (paymentFilter === "UNSETTLED" && tx.closureType !== "UNSETTLED") return false;
            if (paymentFilter === "CANCELLED" && tx.closureType !== "CANCELLED") return false;

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchGuest = tx.guestName.toLowerCase().includes(q);
                const matchTable = tx.tableLabel.toLowerCase().includes(q);
                const matchWaiter = tx.waiterName.toLowerCase().includes(q);
                const matchItems = tx.items.some((i) => i.productName.toLowerCase().includes(q));
                const matchId = tx.id.toLowerCase().includes(q);

                if (!matchGuest && !matchTable && !matchWaiter && !matchItems && !matchId) {
                    return false;
                }
            }

            return true;
        });
    }, [rawTransactions, selectedWaiterId, paymentFilter, searchQuery]);

    // Calculate High-Level Overview KPIs (Filtered dynamically by selected waiter or role)
    const kpis = useMemo(() => {
        const transactionsToUse = selectedWaiterId === "ALL" 
            ? rawTransactions 
            : rawTransactions.filter((t) => {
                if (selectedWaiterId.startsWith("ROLE:")) {
                    const targetRole = selectedWaiterId.replace("ROLE:", "").toLowerCase();
                    const roleStr = (t.waiterRole || "").toLowerCase();
                    return roleStr.includes(targetRole) || targetRole === roleStr;
                }
                return selectedWaiterId === "HOUSE" ? !t.waiterId : t.waiterId === selectedWaiterId;
            });

        // Cancelled / void transactions are tracked separately and excluded from revenue
        const activeTransactions = transactionsToUse.filter((t) => t.closureType !== "CANCELLED");
        const cancelledTransactions = transactionsToUse.filter((t) => t.closureType === "CANCELLED");

        const totalSales = activeTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
        const totalOrders = activeTransactions.length;
        const totalItems = activeTransactions.reduce((acc, t) => acc + t.itemCount, 0);

        const cancelledSales = cancelledTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
        const cancelledCount = cancelledTransactions.length;

        let cashSales = 0;
        let digitalSales = 0;
        let unsettledSales = 0;

        activeTransactions.forEach((t) => {
            if (t.closureType === "CASH") cashSales += t.totalAmount;
            else if (t.closureType === "DIGITAL") digitalSales += t.totalAmount;
            else if (t.closureType === "UNSETTLED") unsettledSales += t.totalAmount;
        });

        const activeStaffCount = waiterSummaries.filter((w) => w.staffId !== "HOUSE").length;

        // Open bills count
        const openBillsCount = bills.filter((b) => b.status === "open").length;

        return {
            totalSales,
            totalOrders,
            totalItems,
            cancelledSales,
            cancelledCount,
            cashSales,
            digitalSales,
            unsettledSales,
            cashPct: totalSales > 0 ? (cashSales / totalSales) * 100 : 0,
            digitalPct: totalSales > 0 ? (digitalSales / totalSales) * 100 : 0,
            activeStaffCount,
            openBillsCount,
            isFullySettled: openBillsCount === 0,
        };
    }, [rawTransactions, waiterSummaries, bills, selectedWaiterId]);

    // Cash Reconciliation
    const expectedCashInDrawer = startingFloat + kpis.cashSales;
    const numericCountedCash = parseFloat(countedCash.replace(/[^0-9.]/g, "")) || 0;
    const cashVariance = countedCash.trim() ? numericCountedCash - expectedCashInDrawer : 0;

    // Dates that had POS transactions (combining venue history + currently loaded window)
    const transactionDates = useMemo(() => {
        const set = new Set<string>(historicalTxDates);
        rawTransactions.forEach((tx) => {
            if (tx.createdAt) {
                set.add(tx.createdAt.split("T")[0]);
            }
        });
        return set;
    }, [historicalTxDates, rawTransactions]);

    // Handle Print
    const handlePrintReport = () => {
        window.print();
    };

    /* ═══════════════════════════════════════════════════════════════════════════
       RENDER UI
       ═══════════════════════════════════════════════════════════════════════════ */

    return (
        <div className={`min-h-full w-full bg-[#F4F3E8] text-[#1A110B] font-sans antialiased ${isModal ? "p-4 sm:p-6" : "p-4 sm:p-8"}`}>
            {/* Header / Top Navigation Bar */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#1A110B]/10 pb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#1A110B]">
                        Shift Report
                    </h1>
                </div>

                {/* Right controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Interactive Calendar Date Picker Popover */}
                    <ShiftCalendarPicker
                        range={range}
                        customStart={customStart}
                        customEnd={customEnd}
                        onSelectPreset={(preset) => {
                            setRange(preset);
                            setCustomStart("");
                            setCustomEnd("");
                        }}
                        onSelectCustomRange={(start, end) => {
                            setRange("CUSTOM");
                            setCustomStart(start);
                            setCustomEnd(end);
                        }}
                        rangeLabel={rangeLabel}
                        transactionDates={transactionDates}
                        workingDays={workingDays}
                        onToggleWorkingDay={toggleWorkingDay}
                    />

                    {/* Print Button */}
                    <button
                        onClick={handlePrintReport}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A110B] text-white px-3.5 py-2 text-xs font-semibold hover:bg-[#1A110B]/90 transition shadow-md cursor-pointer"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        <span>Print Report</span>
                    </button>

                    {isModal && onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-white border border-[#1A110B]/15 p-2 text-[#1A110B] hover:bg-[#1A110B]/5 transition cursor-pointer"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => void loadShiftData(true)} className="font-bold underline ml-4">
                        Retry
                    </button>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
               TOP SUMMARY KPI STRIP (3 CLEAN CARDS IN LICORICE/BROWN THEME)
               ═══════════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
                {/* Total Gross Revenue */}
                <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[140px]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                            {selectedWaiterId !== "ALL" ? "Waiter Sales Total" : "Shift Revenue"}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                            <CurrencyDollarIcon className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 min-w-0">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                            {formatGHS(kpis.totalSales)}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                            <span className="truncate">{kpis.totalOrders} {kpis.totalOrders === 1 ? "order" : "orders"} placed</span>
                            <span className="shrink-0">{kpis.totalItems} items sold</span>
                        </div>
                    </div>
                </div>

                {/* Cash Collected */}
                <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[140px]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                            Cash Handed In
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                            <BanknotesIcon className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 min-w-0">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                            {formatGHS(kpis.cashSales)}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                            <span className="truncate">{kpis.cashPct.toFixed(1)}% of total</span>
                            <span className="shrink-0 font-semibold text-[#1A110B]/80">Physical Cash</span>
                        </div>
                    </div>
                </div>

                {/* Digital Payments (MoMo / Card) */}
                <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[140px]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                            Digital Payments
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                            <CreditCardIcon className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 min-w-0">
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                            {formatGHS(kpis.digitalSales)}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                            <span className="truncate">{kpis.digitalPct.toFixed(1)}% of total</span>
                            <span className="shrink-0 font-semibold text-[#1A110B]/80">MoMo / Card</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════════
               NAVIGATION TABS & WAITER FILTER BAR
               ═══════════════════════════════════════════════════════════════════════════ */}
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white rounded-xl p-3 border border-[#1A110B]/10 shadow-sm">
                {/* View Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                    <button
                        onClick={() => setActiveTab("TRANSACTIONS")}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap ${
                            activeTab === "TRANSACTIONS"
                                ? "bg-[#1A110B] text-white shadow-sm"
                                : "text-[#1A110B] hover:bg-[#1A110B]/5"
                        }`}
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                        <span>Detailed Transaction List</span>
                        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                            {filteredTransactions.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab("WAITERS")}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap ${
                            activeTab === "WAITERS"
                                ? "bg-[#1A110B] text-white shadow-sm"
                                : "text-[#1A110B] hover:bg-[#1A110B]/5"
                        }`}
                    >
                        <UserIcon className="h-4 w-4" />
                        <span>Waiter Audit Ledger</span>
                        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                            {waiterSummaries.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab("RECONCILIATION")}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap ${
                            activeTab === "RECONCILIATION"
                                ? "bg-[#1A110B] text-white shadow-sm"
                                : "text-[#1A110B] hover:bg-[#1A110B]/5"
                        }`}
                    >
                        <BanknotesIcon className="h-4 w-4" />
                        <span>Shift Cash Balancing</span>
                    </button>
                </div>

                {/* Combined Filter Component */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Active Filter Chips */}
                    {isWaiterFiltered && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A110B]/5 border border-[#1A110B]/10 px-2.5 py-1 text-xs font-semibold text-[#1A110B]">
                            <UserIcon className="h-3 w-3 text-[#606F69]" />
                            <span>{activeWaiter?.displayName || "Staff"}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedWaiterId("ALL")}
                                className="hover:text-rose-700 ml-0.5 cursor-pointer text-[#606F69]"
                                title="Remove order taker filter"
                            >
                                <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    )}

                    {isPaymentFiltered && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A110B]/5 border border-[#1A110B]/10 px-2.5 py-1 text-xs font-semibold text-[#1A110B]">
                            <CreditCardIcon className="h-3 w-3 text-[#606F69]" />
                            <span>{paymentLabels[paymentFilter]}</span>
                            <button
                                type="button"
                                onClick={() => setPaymentFilter("ALL")}
                                className="hover:text-rose-700 ml-0.5 cursor-pointer text-[#606F69]"
                                title="Remove payment filter"
                            >
                                <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    )}

                    {/* Single Combined Filter Button & Popover */}
                    <div className="relative inline-block" ref={filterPopoverRef}>
                        <button
                            type="button"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                                hasActiveFilters
                                    ? "bg-[#1A110B] text-white border-[#1A110B] shadow-sm"
                                    : "bg-[#F4F3E8] text-[#1A110B] border-[#1A110B]/15 hover:bg-[#1A110B]/10"
                            }`}
                        >
                            <FunnelIcon className="h-3.5 w-3.5" />
                            <span>Filters</span>
                            {hasActiveFilters && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-black text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isFilterOpen ? "rotate-180" : "rotate-0"}`} />
                        </button>

                        {/* Combined Filter Popover Panel */}
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 z-40 w-76 sm:w-80 rounded-2xl bg-white p-4 shadow-2xl border border-[#1A110B]/15 text-[#1A110B] animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between pb-2.5 border-b border-[#1A110B]/10">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-[#1A110B]">
                                        Filter Transactions
                                    </span>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedWaiterId("ALL");
                                                setPaymentFilter("ALL");
                                            }}
                                            className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                                        >
                                            Reset All
                                        </button>
                                    )}
                                </div>

                                {/* Order Taker Selector */}
                                <div className="py-3 border-b border-[#1A110B]/10">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-[#606F69] flex items-center gap-1">
                                            <UserIcon className="h-3 w-3 text-[#1A110B]" />
                                            Order Taker
                                        </label>
                                        {isWaiterFiltered && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedWaiterId("ALL")}
                                                className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={selectedWaiterId}
                                            onChange={(e) => setSelectedWaiterId(e.target.value)}
                                            className="w-full appearance-none rounded-xl border border-[#1A110B]/15 bg-[#F4F3E8] px-3 py-2 text-xs font-bold text-[#1A110B] focus:outline-none focus:ring-2 focus:ring-[#1A110B]/20 cursor-pointer pr-8"
                                        >
                                            <option value="ALL">All</option>
                                            {eligibleOrderTakers.map((staff) => (
                                                <option key={staff.id} value={staff.id}>
                                                    {staff.displayName}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#606F69]" />
                                    </div>
                                </div>

                                {/* Paid Via Selector */}
                                <div className="py-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-[#606F69] flex items-center gap-1">
                                            <CreditCardIcon className="h-3 w-3 text-[#1A110B]" />
                                            Paid Via
                                        </label>
                                        {isPaymentFiltered && (
                                            <button
                                                type="button"
                                                onClick={() => setPaymentFilter("ALL")}
                                                className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {[
                                            { id: "ALL", label: "All Types" },
                                            { id: "CASH", label: "Cash Only" },
                                            { id: "DIGITAL", label: "Digital (MoMo/Card)" },
                                            { id: "UNSETTLED", label: "Unsettled / Open" },
                                            { id: "CANCELLED", label: "Cancelled / Void" },
                                        ].map((pm) => {
                                            const active = paymentFilter === pm.id;
                                            return (
                                                <button
                                                    key={pm.id}
                                                    type="button"
                                                    onClick={() => setPaymentFilter(pm.id as PaymentCategory)}
                                                    className={`rounded-xl px-2.5 py-2 text-xs font-bold transition text-center cursor-pointer ${
                                                        active
                                                            ? "bg-[#1A110B] text-white shadow-xs"
                                                            : "bg-[#F4F3E8] text-[#1A110B] hover:bg-[#1A110B]/10"
                                                    }`}
                                                >
                                                    {pm.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Apply / Close */}
                                <div className="pt-2 border-t border-[#1A110B]/10">
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterOpen(false)}
                                        className="w-full rounded-xl bg-[#1A110B] py-2 text-xs font-bold text-white hover:bg-[#1A110B]/90 transition cursor-pointer"
                                    >
                                        Apply Filters
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clear all text button if search or filters active */}
                    {(hasActiveFilters || searchQuery) && (
                        <button
                            onClick={() => {
                                setSelectedWaiterId("ALL");
                                setPaymentFilter("ALL");
                                setSearchQuery("");
                            }}
                            className="text-xs font-semibold text-rose-700 hover:underline px-1 py-1 cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>


            {/* ═══════════════════════════════════════════════════════════════════════════
               TAB 1: DETAILED TRANSACTION LEDGER (ORDERS PAGE VIEW)
               ═══════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "TRANSACTIONS" && (
                <div className="space-y-4">
                    {/* Search bar inside transaction view */}
                    <div className="flex items-center rounded-xl bg-white px-3.5 py-2.5 border border-[#1A110B]/10 shadow-sm">
                        <MagnifyingGlassIcon className="h-4 w-4 text-[#606F69] mr-2 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search transactions by item name (e.g. Hennessy), table, guest, waiter name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#1A110B] placeholder-[#606F69] focus:outline-none"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="text-[#606F69] hover:text-[#1A110B]">
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Table View */}
                    <div className="rounded-xl bg-white border border-[#1A110B]/10 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-xs font-semibold text-[#606F69] flex flex-col items-center gap-2">
                                <ArrowPathIcon className="h-6 w-6 animate-spin text-[#1A110B]" />
                                <span>Loading detailed shift transactions...</span>
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="p-12 text-center text-xs font-semibold text-[#606F69]">
                                No transactions matched the selected filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-[#1A110B]/10 bg-[#1A110B]/5 text-[#1A110B] font-semibold uppercase tracking-wider text-[11px]">
                                            <th className="px-4 py-3">Time & Ref</th>
                                            <th className="px-4 py-3">Table / Area</th>
                                            <th className="px-4 py-3">Assigned Waiter</th>
                                            <th className="px-4 py-3">Items Sold</th>
                                            <th className="px-4 py-3 text-right">Total (GH₵)</th>
                                            <th className="px-4 py-3 text-center">Closure & Verification</th>
                                            <th className="px-4 py-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1A110B]/10 font-medium">
                                        {filteredTransactions.map((tx) => (
                                            <tr
                                                key={tx.id}
                                                className="hover:bg-[#F4F3E8]/50 transition cursor-pointer"
                                                onClick={() => setSelectedTransaction(tx)}
                                            >
                                                {/* Time & Ref */}
                                                <td className="px-4 py-3.5 align-top">
                                                    <div className="font-bold text-[#1A110B]">
                                                        {new Date(tx.createdAt).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </div>
                                                    <div className="text-[10px] text-[#606F69] font-mono mt-0.5">
                                                        #{tx.id.substring(0, 8)}
                                                    </div>
                                                </td>

                                                {/* Table & Guest */}
                                                <td className="px-4 py-3.5 align-top">
                                                    <div className="font-bold text-[#1A110B]">{tx.tableLabel}</div>
                                                    <div className="text-[11px] text-[#606F69]">{tx.guestName}</div>
                                                </td>

                                                {/* Assigned Waiter */}
                                                <td className="px-4 py-3.5 align-top">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-6 w-6 rounded-full bg-[#1A110B] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                                            {tx.waiterName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-[#1A110B]">{tx.waiterName}</div>
                                                            <div className="text-[10px] text-[#606F69]">{tx.waiterRole}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Items Sold */}
                                                <td className="px-4 py-3.5 align-top max-w-xs">
                                                    <div className="flex flex-wrap gap-1">
                                                        {tx.items.slice(0, 3).map((item, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center rounded-md bg-[#1A110B]/5 px-2 py-0.5 text-[11px] font-medium text-[#1A110B]"
                                                            >
                                                                {item.quantity}x {item.productName}
                                                            </span>
                                                        ))}
                                                        {tx.items.length > 3 && (
                                                            <span className="inline-flex items-center rounded-md bg-[#1A110B]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#606F69]">
                                                                +{tx.items.length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                    {tx.notes && (
                                                        <div className="mt-1 text-[10px] italic text-amber-800">
                                                            Note: "{tx.notes}"
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Total Amount */}
                                                <td className="px-4 py-3.5 align-top text-right font-bold text-sm tabular-nums">
                                                    {tx.closureType === "CANCELLED" ? (
                                                        <div>
                                                            <span className="line-through text-[#606F69] text-xs font-semibold">{formatGHS(tx.totalAmount)}</span>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voided</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[#1A110B]">{formatGHS(tx.totalAmount)}</span>
                                                    )}
                                                </td>

                                                {/* Closure & Verification Status Badge */}
                                                <td className="px-4 py-3.5 align-top text-center">
                                                    {tx.closureType === "CASH" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                                                            <BanknotesIcon className="h-3.5 w-3.5" />
                                                            Closed - Cash
                                                        </span>
                                                    ) : tx.closureType === "DIGITAL" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 border border-indigo-300 px-2.5 py-1 text-[11px] font-bold text-indigo-900">
                                                            <CreditCardIcon className="h-3.5 w-3.5" />
                                                            Closed - Digital
                                                        </span>
                                                    ) : tx.closureType === "CANCELLED" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                                            <XCircleIcon className="h-3.5 w-3.5 text-slate-500" />
                                                            Cancelled / Void
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-1 text-[11px] font-bold text-rose-900">
                                                            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                                            Open Tab / Unpaid
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Inspector Action */}
                                                <td className="px-4 py-3.5 align-top text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTransaction(tx);
                                                        }}
                                                        className="rounded-lg bg-[#1A110B]/5 hover:bg-[#1A110B]/10 p-1.5 text-[#1A110B] transition"
                                                        title="View full itemized order details"
                                                    >
                                                        <ChevronRightIcon className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
               TAB 2: WAITER AUDIT LEDGER (BREAKDOWN PER STAFF MEMBER)
               ═══════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "WAITERS" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {waiterSummaries.map((waiter) => (
                        <div
                            key={waiter.staffId}
                                className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between transition hover:border-[#1A110B]/20"
                            >
                                <div>
                                    {/* Waiter Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A110B] text-white font-black text-sm">
                                                {waiter.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-[#1A110B]">{waiter.name}</h3>
                                                <span className="text-[11px] font-semibold text-[#606F69]">
                                                    {waiter.role}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                waiter.isFullyClosed
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-amber-100 text-amber-900"
                                            }`}
                                        >
                                            {waiter.isFullyClosed ? "All Tables Closed" : `${waiter.openBillsCount} Open Tabs`}
                                        </span>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="my-4 rounded-xl bg-[#F4F3E8] p-3.5 space-y-2 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[#606F69]">Total Sales Generated:</span>
                                            <span className="font-bold text-sm text-[#1A110B] tabular-nums">
                                                {formatGHS(waiter.totalSales)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-[#1A110B]/10 pt-2">
                                            <span className="text-amber-900 font-medium flex items-center gap-1">
                                                <BanknotesIcon className="h-3.5 w-3.5" /> Cash Collected:
                                            </span>
                                            <span className="font-bold text-amber-950 tabular-nums">
                                                {formatGHS(waiter.cashCollected)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-indigo-900 font-medium flex items-center gap-1">
                                                <CreditCardIcon className="h-3.5 w-3.5" /> Digital Processed:
                                            </span>
                                            <span className="font-bold text-indigo-950 tabular-nums">
                                                {formatGHS(waiter.digitalCollected)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats Strip */}
                                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-4">
                                        <div className="rounded-lg bg-[#1A110B]/5 p-2">
                                            <div className="font-bold text-[#1A110B]">{waiter.ordersCount}</div>
                                            <div className="text-[10px] text-[#606F69]">Orders</div>
                                        </div>
                                        <div className="rounded-lg bg-[#1A110B]/5 p-2">
                                            <div className="font-bold text-[#1A110B]">{waiter.itemsCount}</div>
                                            <div className="text-[10px] text-[#606F69]">Items</div>
                                        </div>
                                        <div className="rounded-lg bg-[#1A110B]/5 p-2">
                                            <div className="font-bold text-[#1A110B]">
                                                {waiter.tablesServed.size}
                                            </div>
                                            <div className="text-[10px] text-[#606F69]">Tables</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Action */}
                                <button
                                    onClick={() => {
                                        setSelectedWaiterId(waiter.staffId);
                                        setActiveTab("TRANSACTIONS");
                                    }}
                                    className="w-full rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 bg-[#1A110B] text-white hover:bg-[#1A110B]/90 cursor-pointer shadow-sm"
                                >
                                    <span>Audit Orders for Waiter</span>
                                    <ChevronRightIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
               TAB 3: SHIFT CASH RECONCILIATION & BALANCING
               ═══════════════════════════════════════════════════════════════════════════ */}
            {activeTab === "RECONCILIATION" && (
                <div className="max-w-2xl mx-auto rounded-xl bg-white p-6 border border-[#1A110B]/10 shadow-sm space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-[#1A110B] flex items-center gap-2">
                            <BanknotesIcon className="h-5 w-5 text-amber-800" />
                            Shift Cash Drawer Reconciliation
                        </h2>
                        <p className="text-xs text-[#606F69] mt-0.5">
                            Audit expected cash handed in by waiters against physical cash counted in drawer at shift close.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="rounded-xl bg-[#F4F3E8] p-4 space-y-3">
                            <label className="font-bold text-[#1A110B] block">Starting Cash Float (GH₵)</label>
                            <input
                                type="number"
                                value={startingFloat}
                                onChange={(e) => setStartingFloat(Number(e.target.value))}
                                className="w-full rounded-lg border border-[#1A110B]/15 p-2.5 font-bold text-sm bg-white"
                            />
                            <p className="text-[10px] text-[#606F69]">Cash left in till at start of shift.</p>
                        </div>

                        <div className="rounded-xl bg-[#F4F3E8] p-4 space-y-3">
                            <label className="font-bold text-[#1A110B] block">Counted Cash at Close (GH₵)</label>
                            <input
                                type="text"
                                placeholder="e.g. 1500"
                                value={countedCash}
                                onChange={(e) => setCountedCash(e.target.value)}
                                className="w-full rounded-lg border border-[#1A110B]/15 p-2.5 font-bold text-sm bg-white"
                            />
                            <p className="text-[10px] text-[#606F69]">Physical cash counted in drawer.</p>
                        </div>
                    </div>

                    {/* Calculation Audit Card */}
                    <div className="rounded-xl bg-[#1A110B] text-white p-5 space-y-3 text-xs">
                        <div className="flex justify-between items-center text-white/70">
                            <span>Starting Till Float:</span>
                            <span className="font-mono tabular-nums">{formatGHS(startingFloat)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/70">
                            <span>+ Waiters Cash Sales Collected:</span>
                            <span className="font-mono tabular-nums text-amber-400">+{formatGHS(kpis.cashSales)}</span>
                        </div>
                        <div className="border-t border-white/10 pt-2 flex justify-between items-center font-bold text-sm">
                            <span>= System Expected Cash in Till:</span>
                            <span className="font-mono text-emerald-400 tabular-nums">{formatGHS(expectedCashInDrawer)}</span>
                        </div>

                        {countedCash.trim() && (
                            <div className="border-t border-white/10 pt-3 flex justify-between items-center font-black text-base">
                                <span>Cash Drawer Variance:</span>
                                <span
                                    className={`font-mono tabular-nums ${
                                        cashVariance === 0
                                            ? "text-emerald-400"
                                            : cashVariance > 0
                                            ? "text-blue-400"
                                            : "text-rose-400"
                                    }`}
                                >
                                    {cashVariance >= 0 ? `+${formatGHS(cashVariance)}` : formatGHS(cashVariance)}
                                    {cashVariance === 0 ? " (Balanced Cleanly)" : cashVariance > 0 ? " (Over)" : " (Short)"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
               TRANSACTION INSPECTOR DRAWER / MODAL
               ═══════════════════════════════════════════════════════════════════════════ */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#1A110B]/20 text-[#1A110B] space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#606F69]">
                                    Transaction Audit Details
                                </span>
                                <h3 className="text-lg font-black text-[#1A110B]">
                                    {selectedTransaction.tableLabel} · {selectedTransaction.guestName}
                                </h3>
                                <p className="text-xs text-[#606F69]">
                                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedTransaction(null)}
                                className="rounded-xl bg-[#1A110B]/5 hover:bg-[#1A110B]/10 p-2 text-[#1A110B]"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Waiter & Table Info */}
                        <div className="grid grid-cols-2 gap-3 text-xs bg-[#F4F3E8] p-3.5 rounded-xl">
                            <div>
                                <span className="text-[#606F69] block text-[10px] uppercase font-bold">Assigned Waiter</span>
                                <span className="font-bold text-[#1A110B]">{selectedTransaction.waiterName}</span>
                            </div>
                            <div>
                                <span className="text-[#606F69] block text-[10px] uppercase font-bold">Payment Status</span>
                                <span className="font-bold text-[#1A110B]">
                                    {selectedTransaction.closureType === "CASH"
                                        ? "Closed - Cash"
                                        : selectedTransaction.closureType === "DIGITAL"
                                        ? "Closed - Digital"
                                        : selectedTransaction.closureType === "CANCELLED"
                                        ? "Cancelled / Void"
                                        : "Open Tab"}
                                </span>
                            </div>
                        </div>

                        {/* Itemized list */}
                        <div className="space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#606F69]">
                                Itemized Breakdown ({selectedTransaction.itemCount} items)
                            </span>
                            <div className="divide-y divide-[#1A110B]/10 max-h-48 overflow-y-auto rounded-xl border border-[#1A110B]/10 p-3 text-xs">
                                {selectedTransaction.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1.5">
                                        <div>
                                            <span className="font-bold">{it.quantity}x</span> {it.productName}
                                        </div>
                                        <span className="font-bold tabular-nums">{formatGHS(it.lineTotal)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Total Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#1A110B]/10 text-sm font-black">
                            <span>{selectedTransaction.closureType === "CANCELLED" ? "Voided Total:" : "Grand Total:"}</span>
                            <span className={`text-base tabular-nums ${selectedTransaction.closureType === "CANCELLED" ? "line-through text-[#606F69]" : ""}`}>
                                {formatGHS(selectedTransaction.totalAmount)}
                            </span>
                        </div>

                        <button
                            onClick={() => setSelectedTransaction(null)}
                            className="w-full rounded-xl bg-[#1A110B] py-2.5 text-xs font-bold text-white hover:bg-[#1A110B]/90"
                        >
                            Close Inspector
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
