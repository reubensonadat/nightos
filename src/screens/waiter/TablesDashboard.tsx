import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    ArrowRightIcon,
    ArrowPathIcon,
    ClockIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";
import { useRealtime } from "../../hooks/useRealtime";

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

/** Minutes since an ISO timestamp. */
function minutesSince(iso: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
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
    staffId: string;
    role: string;
    onSelectTable: (table: Table) => void;
    onSignOut: () => void;
    onViewShift?: () => void;
};

function transformToTables(dbTables: any[], openBills: any[], waiterNames: Record<string, string>): Table[] {
    const billMap = new Map<string, any>();
    for (const b of openBills) {
        billMap.set(b.table_id, b);
    }
    return dbTables.map((t) => {
        const bill = billMap.get(t.id);
        if (bill) {
            const guestCount = bill.guest_count ?? 1;
            const seatedAt = bill.created_at;
            const waiterId = bill.waiter_id as string | null;
            return {
                id: t.id,
                number: t.table_number,
                label: t.table_label,
                status: 'occupied' as const,
                guests: guestCount,
                tabTotal: bill.total,
                seatedAt,
                server: waiterId ? (waiterNames[waiterId] ?? undefined) : undefined,
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

export function TablesDashboard({ venueId, staffName, staffId: _staffId, role, onSelectTable, onSignOut, onViewShift }: Props) {
    const [tables, setTables] = useState<Table[]>([]);
    const [filter, setFilter] = useState<Filter>("all");
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const reloadTimer = useRef<number | null>(null);
    const waiterNamesRef = useRef<Record<string, string>>({});

    const scheduleReload = useCallback(() => {
        if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
        reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
    }, []);

    const fetchData = useCallback(async () => {
        if (!venueId) return;
        setRefreshing(true);
        try {
            const [tablesResult, billsResult] = await Promise.all([
                db.tablesByVenue(venueId),
                db.billsByVenue(venueId),
            ]);
            if (tablesResult.error) throw tablesResult.error;
            const billRows = billsResult.data ?? [];
            setTables(transformToTables(tablesResult.data ?? [], billRows, waiterNamesRef.current));

            const waiterIds = [
                ...new Set(
                    billRows.map((b: any) => b.waiter_id).filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
                ),
            ];
            if (waiterIds.length > 0) {
                const { data: staffRows } = await db.staffNamesByIds(waiterIds);
                const names = Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.name]));
                waiterNamesRef.current = names;
                setTables(transformToTables(tablesResult.data ?? [], billRows, names));
            }
        } catch {
            // No mock fallback — the grid shows the empty state instead.
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [venueId]);

    const fetchDataRef = useRef(fetchData);
    fetchDataRef.current = fetchData;

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Live updates: bills change when customers land, order or settle.
    useRealtime({
        table: "bills",
        filter: `venue_id=eq.${venueId}`,
        onInsert: scheduleReload,
        onUpdate: scheduleReload,
        onDelete: scheduleReload,
    });

    useEffect(() => () => {
        if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    }, []);

    const displayTables = tables;

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
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                {/* Top bar */}
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                            <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                                V
                            </span>
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-bold tracking-tight text-licorice">
                                {staffName}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                                {role} · Floor
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            aria-label="Refresh tables"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                        >
                            <ArrowPathIcon
                                className={`h-4 w-4 transition-transform ${refreshing ? "animate-spin" : ""}`}
                                strokeWidth={2.25}
                            />
                        </button>
                        <div className="flex items-center gap-1">
                            {onViewShift && (
                                <button
                                    type="button"
                                    onClick={onViewShift}
                                    aria-label="View shift performance"
                                    className="rounded-full bg-white px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-feldgrau shadow-sm ring-1 ring-licorice/8 transition-colors hover:text-licorice active:scale-95"
                                >
                                    Shift
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onSignOut}
                                className="text-[10px] font-bold uppercase tracking-wider text-feldgrau transition-colors hover:text-dark-red"
                            >
                                Sign Out
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
                {loading ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                        <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">
                            Loading tables…
                        </p>
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            No tables yet
                        </span>
                        <p className="mt-2 max-w-sm text-[12px] leading-relaxed tracking-tight text-feldgrau">
                            This venue has no active tables in the database. Add tables from the
                            manager side (or re-run{" "}
                            <code className="rounded bg-isabelline px-1.5 py-0.5 font-mono text-[11px]">
                                supabase/seed-velvet.sql
                            </code>
                            ), then refresh.
                        </p>
                    </div>
                ) : filteredTables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                        <p className="text-[12px] font-bold tracking-tight text-feldgrau">
                            No {filter} tables right now.
                        </p>
                    </div>
                ) : (
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
                                    <p className="mt-0.5 font-serif text-[28px] font-black leading-none tracking-[-0.04em] text-licorice">
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
                                            {table.seatedAt && (
                                                <span className="inline-flex items-center gap-1">
                                                    <ClockIcon className="h-3 w-3" strokeWidth={2.25} />
                                                    {formatDuration(minutesSince(table.seatedAt))}
                                                </span>
                                            )}
                                        </div>
                                        {table.tabTotal !== undefined && (
                                            <p className="mt-2 font-mono text-[16px] font-bold tabular-nums text-licorice">
                                                {formatGHS(table.tabTotal)}
                                            </p>
                                        )}
                                        {table.server && (
                                            <p className="mt-1 text-[10px] font-semibold tracking-tight text-feldgrau/80">
                                                Served by {table.server}
                                            </p>
                                        )}
                                    </>
                                )}

                                {table.status === "reserved" && (
                                    <>
                                        <div className="flex items-center gap-3 text-[10px] font-semibold tracking-tight text-feldgrau">
                                            <span className="inline-flex items-center gap-1">
                                                <ClockIcon className="h-3 w-3" strokeWidth={2.25} />
                                                {table.reservationTime}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <UserGroupIcon className="h-3 w-3" strokeWidth={2.25} />
                                                {table.reservationGuests}
                                            </span>
                                        </div>
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
                )}
            </section>
        </main>
    );
}
