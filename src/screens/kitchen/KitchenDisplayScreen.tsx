import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRealtime } from "../../hooks/useRealtime";
import { ArrowPathIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";
import { OrderCard, type KitchenOrder, type OrderStatus } from "../../components/OrderCard";
import { db, type DbKitchenOrderRow } from "../../lib/api";

/* ────────────────────────── Station filter ────────────────────────── */

type StationFilter = "all" | "Kitchen" | "Bar";

const STATION_FILTERS: { id: StationFilter; label: string }[] = [
    { id: "all", label: "All Stations" },
    { id: "Kitchen", label: "Kitchen" },
    { id: "Bar", label: "Bar" },
];

/* ────────────────────────── Column config ────────────────────────── */

type Column = {
    status: OrderStatus;
    label: string;
    accent: string; // tailwind color class for header bar
    countBg: string;
};

const COLUMNS: Column[] = [
    {
        status: "pending",
        label: "Pending",
        accent: "bg-feldgrau",
        countBg: "bg-feldgrau/15 text-feldgrau",
    },
    {
        status: "preparing",
        label: "Preparing",
        accent: "bg-khaki",
        countBg: "bg-khaki/20 text-khaki",
    },
    {
        status: "ready",
        label: "Ready",
        accent: "bg-licorice",
        countBg: "bg-licorice/10 text-licorice",
    },
];

/* ────────────────────────── Convert DB row to KitchenOrder ────────────────────────── */

function mapStation(s: string): "Kitchen" | "Bar" {
    if (s === "bar") return "Bar";
    return "Kitchen";
}

function orderStatus(s: string): OrderStatus {
    if (s === "preparing") return "preparing";
    if (s === "ready") return "ready";
    return "pending";
}

function rowToOrder(row: DbKitchenOrderRow, waiterNames: Record<string, string>): KitchenOrder {
    const bill = Array.isArray(row.bills) ? row.bills[0] : row.bills;
    const table = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
    return {
        id: row.id,
        tableNumber: table?.table_number ?? 0,
        station: mapStation(row.station),
        status: orderStatus(row.status),
        placedAt: row.created_at,
        server: bill?.waiter_id
            ? waiterNames[bill.waiter_id] ?? "—"
            : "—",
        items: (row.order_items ?? []).map((oi) => ({
            name: oi.product_name,
            quantity: oi.quantity,
            ...(oi.notes ? { notes: oi.notes } : {}),
        })),
    };
}

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    venueId: string;
    staffId: string;
    staffName: string;
    onExit?: () => void;
    onSignOut?: () => void;
};

export function KitchenDisplayScreen({ venueId, staffId, staffName, onExit, onSignOut }: Props) {
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [now, setNow] = useState(Date.now());
    const [stationFilter, setStationFilter] = useState<StationFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ── Load real orders ── */
    const load = useCallback(async () => {
        const { data: rows, error: dbError } = await db.kitchenOrders(venueId);
        if (dbError || !rows) {
            setError("Couldn't load orders — check your connection.");
            setLoading(false);
            return;
        }
        setError(null);

        // waiter names for the cards
        const waiterIds = Array.from(
            new Set(rows.map((r) => (Array.isArray(r.bills) ? r.bills[0] : r.bills)?.waiter_id).filter((id): id is string => !!id)),
        );
        const { data: staffRows } = await db.staffNamesByIds(waiterIds);

        const waiterNames: Record<string, string> = {};
        for (const s of staffRows ?? []) waiterNames[s.id] = s.name;

        setOrders(rows.map((r) => rowToOrder(r, waiterNames)));
        setLoading(false);
    }, [venueId]);

    useEffect(() => {
        load();
    }, [load]);

    // Live updates — no polling. A new/updated submission (or its items)
    // reloads the board; the debounce covers the submission+items pair.
    const reloadTimer = useRef<number | null>(null);
    const scheduleReload = useCallback(() => {
        if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
        reloadTimer.current = window.setTimeout(() => {
            reloadTimer.current = null;
            load();
        }, 500);
    }, [load]);

    useRealtime({
        table: 'order_submissions',
        filter: `venue_id=eq.${venueId}`,
        onInsert: scheduleReload,
        onUpdate: scheduleReload,
        onDelete: scheduleReload,
    });
    useRealtime({
        table: 'order_items',
        onInsert: scheduleReload,
    });

    /* ── Auto-refresh tick: update "now" every 30s for timer accuracy ── */
    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 30_000);
        return () => window.clearInterval(interval);
    }, []);

    /* ── Filter by station ── */
    const filteredOrders = useMemo(
        () =>
            stationFilter === "all"
                ? orders
                : orders.filter((o) => o.station === stationFilter),
        [orders, stationFilter]
    );

    /* ── Group by status ── */
    const ordersByStatus = useMemo(() => {
        const groups: Record<OrderStatus, KitchenOrder[]> = {
            pending: [],
            preparing: [],
            ready: [],
        };
        for (const order of filteredOrders) {
            groups[order.status].push(order);
        }
        for (const status of Object.keys(groups) as OrderStatus[]) {
            groups[status].sort(
                (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
            );
        }
        return groups;
    }, [filteredOrders]);

    /* ── Status mutations (validated server-side) ── */
    const changeStatus = useCallback(
        async (orderId: string, status: 'preparing' | 'ready' | 'served') => {
            const prev = orders;
            setOrders((o) =>
                o.map((x) =>
                    x.id === orderId && status !== 'served' ? { ...x, status } : x
                )
            );
            if (status === 'served') setOrders((o) => o.filter((x) => x.id !== orderId));
            const { data: ok, error: dbError } = await db.setOrderStatus(orderId, status, staffId);
            if (dbError || !ok) {
                setOrders(prev);
                setError("Status change failed — try again.");
            } else {
                setError(null);
            }
        },
        [orders, staffId]
    );

    /* ── Header stats ── */
    const totalOrders = filteredOrders.length;
    const pendingCount = ordersByStatus.pending.length;
    const preparingCount = ordersByStatus.preparing.length;
    const readyCount = ordersByStatus.ready.length;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                STICKY HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-licorice text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.18)]">
                <div className="mx-auto w-full max-w-[1400px] px-6 pt-[max(env(safe-area-inset-top),16px)] pb-4">
                    {/* Top row */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-isabelline text-licorice">
                                <span className="font-serif text-[16px] font-bold leading-none tracking-tight">
                                    V
                                </span>
                            </div>
                            <div className="flex flex-col leading-tight">
                                <span className="text-[14px] font-bold tracking-tight">
                                    Kitchen Display
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-isabelline/60">
                                    Velvet Lounge · {staffName}
                                </span>
                            </div>
                        </div>

                        {/* Live clock */}
                        <div className="hidden md:flex flex-col items-center leading-tight">
                            <span className="font-mono text-[22px] font-black tabular-nums tracking-tight">
                                {new Date(now).toLocaleTimeString("en-GH", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                })}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-isabelline/60">
                                {new Date(now).toLocaleDateString("en-GH", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </span>
                        </div>

                        {/* Refresh + exit */}
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-isabelline/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-isabelline/80">
                                <ArrowPathIcon className="h-3 w-3 animate-spin" strokeWidth={2.5} style={{ animationDuration: "3s" }} />
                                Live
                            </div>
                            {onSignOut && (
                                <button
                                    type="button"
                                    onClick={onSignOut}
                                    className="rounded-full bg-isabelline/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-isabelline/80 transition-colors hover:bg-isabelline/20"
                                >
                                    Switch staff
                                </button>
                            )}
                            {onExit && (
                                <button
                                    type="button"
                                    onClick={onExit}
                                    className="rounded-full bg-isabelline/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-isabelline/80 transition-colors hover:bg-isabelline/20"
                                >
                                    Exit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom row: station filter + summary */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        {/* Station filter */}
                        <div className="flex items-center gap-1 rounded-full bg-isabelline/10 p-1">
                            {STATION_FILTERS.map((sf) => {
                                const isActive = sf.id === stationFilter;
                                return (
                                    <button
                                        key={sf.id}
                                        type="button"
                                        onClick={() => setStationFilter(sf.id)}
                                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold tracking-tight transition-all duration-200 ${isActive
                                            ? "bg-isabelline text-licorice shadow-sm"
                                            : "text-isabelline/70 hover:text-isabelline"
                                            }`}
                                    >
                                        {sf.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Summary chips */}
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-isabelline/10 px-3 py-1.5 text-isabelline/80">
                                <SpeakerWaveIcon className="h-3 w-3" strokeWidth={2.25} />
                                Sound on
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-isabelline/10 px-3 py-1.5 text-isabelline/80">
                                {totalOrders} active
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                THREE-COLUMN QUEUE
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-[1400px] px-6 py-6">
                {error && (
                    <div className="mb-4 rounded-xl bg-dark-red/8 px-4 py-3 text-[12px] font-semibold tracking-tight text-dark-red ring-1 ring-dark-red/20">
                        {error}
                    </div>
                )}

                {loading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                        <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-feldgrau/60">
                            Loading orders…
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {COLUMNS.map((col) => {
                            const colOrders = ordersByStatus[col.status];
                            const count =
                                col.status === "pending"
                                    ? pendingCount
                                    : col.status === "preparing"
                                        ? preparingCount
                                        : readyCount;
                            return (
                                <div key={col.status} className="flex flex-col">
                                    {/* Column header */}
                                    <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-isabelline">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
                                            <h2 className="text-[13px] font-bold tracking-tight text-licorice">
                                                {col.label}
                                            </h2>
                                        </div>
                                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${col.countBg}`}>
                                            {count}
                                        </span>
                                    </div>

                                    {/* Cards */}
                                    <div className="flex flex-col gap-3">
                                        {colOrders.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-licorice/10 px-6 py-12 text-center">
                                                <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                                                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-feldgrau/60">
                                                    No orders
                                                </p>
                                                <p className="mt-1 text-[10px] tracking-tight text-feldgrau/50">
                                                    {col.status === "pending"
                                                        ? "New orders appear here as customers send them"
                                                        : col.status === "preparing"
                                                            ? "Tap Start on a pending order"
                                                            : "Completed orders queue here"}
                                                </p>
                                            </div>
                                        ) : (
                                            colOrders.map((order) => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    now={now}
                                                    onAdvance={(id) => changeStatus(id, "preparing")}
                                                    onMarkReady={(id) => changeStatus(id, "ready")}
                                                    onMarkServed={(id) => changeStatus(id, "served")}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                FOOTER LEGEND
              ═══════════════════════════════════════════════════════════ */}
            <footer className="mx-auto w-full max-w-[1400px] px-6 pb-6">
                <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white px-5 py-3 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                        <span className="h-2 w-2 rounded-full bg-feldgrau" />
                        {"Fresh (< 10m)"}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-khaki">
                        <span className="h-2 w-2 rounded-full bg-khaki" />
                        {"Warming (10–20m)"}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-dark-red">
                        <span className="h-2 w-2 rounded-full bg-dark-red" />
                        {"Urgent (> 20m)"}
                    </div>
                </div>
            </footer>
        </main>
    );
}
