import { useState, useMemo, useEffect, useCallback } from "react";
import {
    ArrowRightIcon,
    ArrowPathIcon,
    UserGroupIcon,
    ChartBarIcon,
    ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";

/* ────────────────────────── Table types ────────────────────────── */

export type TableStatus = "available" | "occupied" | "reserved";

export type Table = {
    id: string;
    number: number;
    label: string;
    status: TableStatus;
    guests?: number;
    tabTotal?: number;
    seatedAt?: string; // ISO time string
    reservationTime?: string;
    reservationGuests?: number;
    server?: string;
};

const MOCK_TABLES: Table[] = [
    { id: "t01", number: 1, label: "1", status: "available" },
    {
        id: "t02", number: 2, label: "2", status: "occupied",
        guests: 2, tabTotal: 245, seatedAt: new Date(Date.now() - 45 * 60_000).toISOString(), server: "Kojo",
    },
    {
        id: "t03", number: 3, label: "3", status: "reserved",
        reservationTime: "7:30 PM", reservationGuests: 4,
    },
    {
        id: "t04", number: 4, label: "4", status: "occupied",
        guests: 1, tabTotal: 95, seatedAt: new Date(Date.now() - 18 * 60_000).toISOString(), server: "Kojo",
    },
    { id: "t05", number: 5, label: "5", status: "available" },
    {
        id: "t06", number: 6, label: "6", status: "occupied",
        guests: 6, tabTotal: 480, seatedAt: new Date(Date.now() - 90 * 60_000).toISOString(), server: "Ama",
    },
    { id: "t07", number: 7, label: "7", status: "available" },
    {
        id: "t08", number: 8, label: "8", status: "occupied",
        guests: 3, tabTotal: 180, seatedAt: new Date(Date.now() - 35 * 60_000).toISOString(), server: "Kojo",
    },
];

/* ────────────────────────── Helpers ────────────────────────── */

function statusLabel(status: TableStatus): string {
    switch (status) {
        case "available":
            return "Available";
        case "occupied":
            return "Occupied";
        case "reserved":
            return "Reserved";
    }
}

function statusBg(status: TableStatus): string {
    switch (status) {
        case "available":
            return "bg-feldgrau/10 text-feldgrau";
        case "occupied":
            return "bg-khaki/20 text-licorice";
        case "reserved":
            return "bg-light-blue/20 text-licorice";
    }
}

function statusDot(status: TableStatus): string {
    switch (status) {
        case "available":
            return "bg-feldgrau";
        case "occupied":
            return "bg-khaki";
        case "reserved":
            return "bg-light-blue";
    }
}

/* ────────────────────────── Filter chips ────────────────────────── */

type Filter = "all" | "occupied" | "available" | "reserved";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "occupied", label: "Occupied" },
    { id: "available", label: "Available" },
    { id: "reserved", label: "Reserved" },
];

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    venueId: string;
    staffName: string;
    onSelectTable: (table: Table) => void;
    onSignOut: () => void;
    onViewShift?: () => void;
};

function transformToTables(dbTables: any[], openBills: any[]): Table[] {
    const billMap = new Map<string, any>();
    for (const b of openBills) {
        billMap.set(b.table_id, b);
    }
    return dbTables.map((t) => {
        const bill = billMap.get(t.id);
        if (bill) {
            const guestCount = bill.guest_count ?? 1;
            const seatedAt = bill.created_at;
            // estimate duration from bill created_at
            return {
                id: t.id,
                number: t.table_number,
                label: t.table_label,
                status: 'occupied' as const,
                guests: guestCount,
                tabTotal: bill.total,
                seatedAt,
                server: undefined, // bill.waiter_id could be resolved
            };
        }
        return {
            id: t.id,
            number: t.table_number,
            label: t.table_label,
            status: 'available' as const,
        };
    });
}

export function TablesDashboard({ venueId, staffName, onSelectTable, onSignOut, onViewShift }: Props) {
    const [tables, setTables] = useState<Table[]>(MOCK_TABLES);
    const [filter, setFilter] = useState<Filter>("all");
    const [refreshing, setRefreshing] = useState(false);
    const [useMock, setUseMock] = useState(false);

    const fetchData = useCallback(async () => {
        if (!venueId) return;
        setRefreshing(true);
        try {
            const [tablesResult, billsResult] = await Promise.all([
                db.tablesByVenue(venueId),
                db.billsByVenue(venueId),
            ]);
            if (tablesResult.data && tablesResult.data.length > 0) {
                const transformed = transformToTables(tablesResult.data, billsResult.data ?? []);
                setTables(transformed);
                setUseMock(false);
            } else {
                setUseMock(true);
            }
        } catch {
            setUseMock(true);
        } finally {
            setRefreshing(false);
        }
    }, [venueId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const displayTables = useMemo(
        () => (useMock ? MOCK_TABLES : tables),
        [useMock, tables]
    );

    const filteredTables = useMemo(
        () => (filter === "all" ? displayTables : displayTables.filter((t) => t.status === filter)),
        [filter, displayTables]
    );

    const summary = useMemo(() => {
        const occupied = displayTables.filter((t) => t.status === "occupied");
        const totalTabs = occupied.reduce((sum, t) => sum + (t.tabTotal ?? 0), 0);
        return {
            occupied: occupied.length,
            total: displayTables.length,
            openTabs: totalTabs,
        };
    }, [displayTables]);

    const handleRefresh = () => {
        fetchData();
    };

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-khaki/15 font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-khaki/20 backdrop-blur-xl border-b border-licorice/8">
                {/* Top bar */}
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                            <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                                V
                            </span>
                        </div>
                        <span className="text-[14px] font-bold tracking-tight text-licorice">
                            {staffName}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            {onViewShift && (
                                <button
                                    type="button"
                                    onClick={onViewShift}
                                    aria-label="View shift performance"
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                                >
                                    <ChartBarIcon className="h-4 w-4" strokeWidth={2.25} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onSignOut}
                                aria-label="Sign out"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-dark-red shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                            >
                                <ArrowRightStartOnRectangleIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary bar */}
                <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3">
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-licorice/8">
                        <div className="text-center">
                            <p className="font-mono text-[18px] font-black tabular-nums text-licorice">
                                {summary.occupied}
                                <span className="text-[11px] font-bold text-feldgrau">
                                    /{summary.total}
                                </span>
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                Occupied
                            </p>
                        </div>
                        <div className="border-x border-isabelline text-center">
                            <p className="font-mono text-[18px] font-black tabular-nums text-khaki">
                                {formatGHS(summary.openTabs)}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                Open Tabs
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[18px] font-black tabular-nums text-licorice">
                                {summary.total - summary.occupied}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                Free
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filter chips */}
                <nav className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3">
                    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                        {FILTERS.map((f) => {
                            const isActive = f.id === filter;
                            const count =
                                f.id === "all"
                                    ? displayTables.length
                                    : displayTables.filter((t) => t.status === f.id).length;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFilter(f.id)}
                                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${isActive
                                        ? "bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]"
                                        : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                        }`}
                                >
                                    {f.label}
                                    <span
                                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums ${isActive
                                            ? "bg-isabelline/15 text-isabelline/80"
                                            : "bg-isabelline text-feldgrau/70"
                                            }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                TABLES GRID
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-5 pb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                    {filteredTables.map((table, idx) => (
                        <button
                            key={table.id}
                            type="button"
                            onClick={() => onSelectTable(table)}
                            className="
                                animate-velvet-rise
                                group flex flex-col rounded-2xl bg-white
                                shadow-[0_4px_16px_rgba(35,20,12,0.06)]
                                ring-1 ring-isabelline
                                transition-all duration-200 ease-out
                                hover:shadow-[0_12px_28px_rgba(35,20,12,0.10)]
                                hover:ring-khaki/30
                                active:scale-[0.98]
                                text-left
                            "
                            style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                        >
                            {/* Top row: number + status */}
                            <div className="flex items-start justify-between px-3.5 pt-3.5">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                                        Table
                                    </p>
                                    <p className="mt-0.5 text-3xl font-bold font-sans tracking-tight text-licorice">
                                        {String(table.number).padStart(2, "0")}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] ${statusBg(table.status)}`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(table.status)}`} />
                                    {statusLabel(table.status)}
                                </span>
                            </div>

                            {/* Details */}
                            <div className="flex-1 px-3.5 pb-3.5 pt-3">
                                {table.status === "occupied" && (
                                    <>
                                        <div className="flex items-center gap-3 text-[10px] font-semibold tracking-tight text-feldgrau">
                                            <span className="inline-flex items-center gap-1">
                                                <UserGroupIcon className="h-3 w-3" strokeWidth={2.25} />
                                                {table.guests}
                                            </span>
                                        </div>
                                        {table.tabTotal !== undefined && (
                                            <p className="mt-2 font-mono text-[16px] font-bold tabular-nums text-licorice">
                                                {formatGHS(table.tabTotal)}
                                            </p>
                                        )}
                                    </>
                                )}

                                {table.status === "reserved" && (
                                    <>
                                        {table.reservationGuests && (
                                            <div className="flex items-center gap-3 text-[10px] font-semibold tracking-tight text-feldgrau">
                                                <span className="inline-flex items-center gap-1">
                                                    <UserGroupIcon className="h-3 w-3" strokeWidth={2.25} />
                                                    {table.reservationGuests}
                                                </span>
                                            </div>
                                        )}
                                        <p className="mt-2 text-[11px] font-medium tracking-tight text-feldgrau">
                                            Reserved for arrival
                                        </p>
                                    </>
                                )}

                                {table.status === "available" && (
                                    <p className="text-[11px] font-medium tracking-tight text-feldgrau">
                                        Ready for new guests
                                    </p>
                                )}
                            </div>

                            {/* Action arrow */}
                            <div className="flex items-center justify-between border-t border-isabelline px-3.5 py-2">
                                <span className="text-[10px] font-bold tracking-tight text-feldgrau">
                                    {table.status === "occupied"
                                        ? "Manage"
                                        : table.status === "reserved"
                                            ? "View"
                                            : "Open"}
                                </span>
                                <ArrowRightIcon
                                    className="h-3.5 w-3.5 text-feldgrau transition-transform group-hover:translate-x-0.5 group-hover:text-licorice"
                                    strokeWidth={2.5}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </section>
        </main>
    );
}
