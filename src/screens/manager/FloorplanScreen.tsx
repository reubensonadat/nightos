import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDownTrayIcon,
    CheckIcon,
    ClockIcon,
    LinkIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    UserGroupIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import QRCode from "qrcode";
import clsx from "clsx";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbTable } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import { useRealtime } from "../../hooks/useRealtime";
import { ConfirmModal } from "../../components/ConfirmModal";
import { PrintableQrModal } from "../../components/PrintableQrModal";

/* ────────────────────────── Types ────────────────────────── */

type FloorTable = DbTable & {
    status: "available" | "occupied";
    guests?: number;
    tabTotal?: number;
    seatedAt?: string;
    waiterName?: string | null;
    ageMinutes?: number;
    billId?: string;
};

/* ────────────────────────── Real QR Code ────────────────────────── */

function RealQrCode({ url, size = 200 }: { url: string; size?: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        QRCode.toCanvas(canvasRef.current, url, {
            width: size,
            margin: 1,
            color: { dark: "#23140c", light: "#ffffff" },
        })
            .then(() => {
                if (cancelled) return;
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.style.width = `${size}px`;
                    canvas.style.height = `${size}px`;
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [url, size]);

    return <canvas ref={canvasRef} />;
}

/* ────────────────────────── Active Orders ────────────────────────── */

function TableActiveOrders({ billId, waiterName }: { billId: string; waiterName?: string | null }) {
    const [items, setItems] = useState<Awaited<ReturnType<typeof db.orderItemsByBill>>["data"]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = useCallback(() => {
        let mounted = true;
        // Skip setting loading to true synchronously to avoid cascading renders
        db.orderItemsByBill(billId).then((res) => {
            if (mounted && res.data) setItems(res.data);
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, [billId]);

    useEffect(() => {
        return fetchData();
    }, [fetchData]);

    useRealtime({
        table: "order_items",
        filter: `bill_id=eq.${billId}`,
        onInsert: fetchData,
        onUpdate: fetchData,
        onDelete: fetchData,
    });

    if (loading) {
        return (
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline animate-pulse">
                <div className="h-6 w-32 bg-slate-200 rounded mb-4" />
                <div className="h-10 bg-slate-100 rounded" />
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="mt-6 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-licorice/10 bg-white px-4 py-10 text-center shadow-sm">
                <span className="h-2 w-2 rounded-full bg-licorice/20" />
                <p className="mt-4 text-sm font-bold uppercase tracking-wider text-feldgrau">No orders yet</p>
                <p className="mt-1 text-xs tracking-tight text-feldgrau/70">
                    Guests at this table haven't placed any orders.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Active Orders</h3>
                {waiterName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Server: {waiterName}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Self-Service
                    </span>
                 
                )}
            </div>
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="uppercase tracking-wide text-xs font-medium text-slate-500 border-b border-isabelline">
                            <th className="pb-3 font-normal">Item</th>
                            <th className="pb-3 font-normal">Qty</th>
                            <th className="pb-3 font-normal">Price</th>
                            <th className="pb-3 font-normal">Time</th>
                            <th className="pb-3 font-normal text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline/60 text-sm text-slate-700">
                        {items.map((item) => {
                            const minutesInKitchen = Math.max(0, Math.floor((now - new Date(item.created_at).getTime()) / 60000));
                            return (
                                <tr key={item.id} className="group hover:bg-isabelline/30 transition-colors">
                                    <td className="py-3 pr-2">
                                        <span className="font-medium text-slate-900">{item.product_name}</span>
                                        {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="tabular-nums">{item.quantity}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="tabular-nums">{formatGHS(item.unit_price)}</span>
                                    </td>
                                    <td className="py-3 pr-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums">
                                            <ClockIcon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                            {minutesInKitchen}m
                                        </span>
                                    </td>
                                    <td className="py-3 text-right">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                            item.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                            item.status === 'confirmed' ? 'bg-sky-100 text-sky-800' :
                                            item.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                                            item.status === 'ready' ? 'bg-indigo-100 text-indigo-800' :
                                            item.status === 'served' ? 'bg-emerald-100 text-emerald-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

export function FloorplanScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = useMemo(() => tables.find(t => t.id === selectedId) ?? null, [tables, selectedId]);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<FloorTable | null>(null);
    const [deletingTable, setDeletingTable] = useState<FloorTable | null>(null);
    const [showQrFor, setShowQrFor] = useState<FloorTable | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Force Close Table state
    const [closingTable, setClosingTable] = useState<FloorTable | null>(null);
    const [closingItems, setClosingItems] = useState<Awaited<ReturnType<typeof db.orderItemsByBill>>["data"] | null>(null);
    const [closingLoading, setClosingLoading] = useState(false);

    const reloadTimer = useRef<number | null>(null);
    const waiterNamesRef = useRef<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        try {
            const [tablesResult, billsResult, shiftsResult] = await Promise.all([
                db.tablesByVenue(venue.id),
                db.billsByVenue(venue.id, 0, 500),
                db.activeShiftsByVenue(venue.id),
            ]);
            if (tablesResult.error) throw tablesResult.error;
            const allBills = billsResult.data ?? [];
            const activeBills = allBills.filter((b) => b.status === 'open' || b.status === 'settling');
            const activeStaffIds = new Set((shiftsResult.data ?? []).map((s) => s.staff_id));
            
            // activeBills is sorted newest first. Map keeps the oldest if we map directly, so we use a loop to keep the first (newest)
            const billMap = new Map<string, typeof activeBills[0]>();
            for (const b of activeBills) {
                if (!billMap.has(b.table_id)) {
                    billMap.set(b.table_id, b);
                }
            }

            const rows: FloorTable[] = (tablesResult.data ?? []).map((t) => {
                const bill = billMap.get(t.id);
                if (bill) {
                    const isWaiteronDuty = bill.waiter_id ? activeStaffIds.has(bill.waiter_id) : false;
                    return {
                        ...t,
                        status: "occupied" as const,
                        billId: bill.id,
                        guests: bill.guest_count,
                        tabTotal: bill.total,
                        seatedAt: bill.created_at,
                        ageMinutes: Math.max(
                            0,
                            Math.floor((Date.now() - new Date(bill.created_at).getTime()) / 60_000),
                        ),
                        waiterName: isWaiteronDuty && bill.waiter_id ? waiterNamesRef.current[bill.waiter_id] ?? null : null,
                    };
                }
                return { ...t, status: "available" as const };
            });
            setTables(rows);

            const waiterIds = [
                ...new Set(
                    activeBills
                        .map((b) => b.waiter_id)
                        .filter((id): id is string => typeof id === "string" && id.length > 0 && activeStaffIds.has(id)),
                ),
            ];
            if (waiterIds.length > 0) {
                const { data: staffRows } = await db.staffNamesByIds(waiterIds);
                const names = Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.name]));
                waiterNamesRef.current = names;
                setTables((prev) =>
                    prev.map((t) => {
                        const bill = billMap.get(t.id);
                        const isWaiteronDuty = bill?.waiter_id ? activeStaffIds.has(bill.waiter_id) : false;
                        return isWaiteronDuty && bill?.waiter_id
                            ? { ...t, waiterName: names[bill.waiter_id] ?? null }
                            : { ...t, waiterName: null };
                    }),
                );
            }
        } catch {
            // keep previous rows; nothing to fall back to
        } finally {
            setLoading(false);
        }
    }, [venue.id]);

    const fetchDataRef = useRef(fetchData);
    // eslint-disable-next-line react-hooks/refs
    fetchDataRef.current = fetchData;

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Live: bills change whenever a tab opens or closes.
    useRealtime({
        table: "bills",
        filter: venue.id === "00000000-0000-0000-0000-000000000000" ? undefined : `venue_id=eq.${venue.id}`,
        onInsert: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
        onUpdate: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
        onDelete: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
    });

    useEffect(() => () => {
        if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    }, []);

    const areas = useMemo(() => {
        const order: Record<string, number> = { VIP: 0, Main: 1, Lounge: 2, Bar: 3, Outdoor: 4, Private: 5 };
        return [...new Set(tables.map((t) => t.area))].sort(
            (a, b) => (order[a] ?? 99) - (order[b] ?? 99),
        );
    }, [tables]);

    const occupiedCount = tables.filter((t) => t.status === "occupied").length;
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

    const qrUrlFor = (t: FloorTable) =>
        `${window.location.origin}/?table=${encodeURIComponent(t.qr_code_token)}`;

    const handleDownloadQr = async (t: FloorTable) => {
        const url = qrUrlFor(t);
        const canvas = document.createElement("canvas");
        try {
            await QRCode.toCanvas(canvas, url, { width: 1024, margin: 2 });
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = `bysen-table-${String(t.table_number).padStart(2, "0")}.png`;
            a.click();
        } catch {
            // ignore download errors
        }
    };

    const handleCopyLink = async (t: FloorTable) => {
        try {
            await navigator.clipboard.writeText(qrUrlFor(t));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Header summary ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Tables</p>
                    <p className="text-4xl font-bold tabular-nums text-slate-900">{tables.length}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Occupied</p>
                    <p className="text-4xl font-bold tabular-nums text-slate-900">{occupiedCount}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Capacity</p>
                    <p className="text-4xl font-bold tabular-nums text-slate-900">{totalCapacity}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Guests</p>
                    <p className="text-4xl font-bold tabular-nums text-slate-900">
                        {tables.filter(t => t.status === "occupied").reduce((sum, t) => sum + (t.guests || 0), 0)}
                    </p>
                </div>
            </div>

            {/* ── Floorplan + Details ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Floorplan grid */}
                <div className="lg:col-span-2 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tables</h2>
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-1.5 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/90 active:scale-95"
                        >
                            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Add Table
                        </button>
                    </div>

                    {loading ? (
                        <div className="mt-5 flex flex-col items-center justify-center rounded-[1.5rem] bg-isabelline px-6 py-16 text-center">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                            <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Loading tables…</p>
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="mt-5 flex flex-col items-center justify-center rounded-[1.5rem] bg-isabelline px-6 py-16 text-center">
                            <p className="text-[12px] font-bold tracking-tight text-feldgrau">No tables yet</p>
                            <p className="mt-1 text-xs tracking-tight text-feldgrau/70">
                                Re-run supabase/seed-velvet.sql to create Tables 1–8.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 space-y-6">
                            {areas.map((area) => {
                                const areaTables = tables.filter((t) => t.area === area);
                                if (areaTables.length === 0) return null;
                                return (
                                    <div key={area}>
                                        <p className="text-xs font-bold uppercase text-feldgrau/60">
                                            {area}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                                            {areaTables.map((table) => {
                                                const isSelected = selected?.id === table.id;
                                                const statusColor =
                                                    table.status === "available"
                                                        ? "bg-white border-slate-200 text-slate-900 hover:border-slate-300"
                                                        : "bg-[#E5DCCB] border-[#D4C4B7] text-slate-900";
                                                return (
                                                    <button
                                                        key={table.id}
                                                        type="button"
                                                        onClick={() => setSelectedId(table.id)}
                                                        className={`
                                                            flex flex-col items-center justify-center rounded-xl border p-4
                                                            transition-all duration-150 active:scale-95
                                                            ${statusColor}
                                                            ${isSelected ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-white" : ""}
                                                        `}
                                                    >
                                                        <span className="text-2xl font-bold font-serif tabular-nums tracking-tight">
                                                            {String(table.table_number).padStart(2, "0")}
                                                        </span>
                                                        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
                                                            <UserGroupIcon className="h-4 w-4" strokeWidth={2} />
                                                            {table.capacity}
                                                        </span>
                                                        {table.status === "occupied" && (
                                                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-slate-700">
                                                                <ClockIcon className="h-3 w-3" strokeWidth={2.5} />
                                                                {table.ageMinutes}m
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Details panel */}
                <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase text-feldgrau">Table Details</p>
                        {selected && (
                            <button
                                type="button"
                                onClick={() => setEditingTable(selected)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-isabelline px-3 py-1 text-xs font-bold tracking-tight text-licorice ring-1 ring-licorice/8 transition-all hover:bg-isabelline/80 active:scale-95"
                            >
                                <PencilSquareIcon className="h-3.5 w-3.5 text-licorice" strokeWidth={2.25} />
                                Edit Table
                            </button>
                        )}
                    </div>
                    {selected ? (
                        <div className="mt-4">
                            <div className="flex items-baseline gap-3">
                                <span className="font-serif text-[40px] font-black leading-none tracking-[-0.04em] text-licorice">
                                    {String(selected.table_number).padStart(2, "0")}
                                </span>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">{selected.area}</p>
                                    <p className="text-xs font-medium tracking-tight text-licorice">Capacity: {selected.capacity}</p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2 text-xs">
                                <div className="flex justify-between border-b border-isabelline pb-1.5">
                                    <span className="font-medium tracking-tight text-feldgrau">Status</span>
                                    <span className={`font-bold uppercase tracking-wider ${selected.status === "occupied" ? "text-khaki" : "text-licorice"}`}>
                                        {selected.status}
                                    </span>
                                </div>
                                {selected.guests !== undefined && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Guests</span>
                                        <span className="font-bold tabular-nums text-licorice">{selected.guests}</span>
                                    </div>
                                )}
                                {selected.tabTotal !== undefined && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Open Tab</span>
                                        <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(selected.tabTotal)}</span>
                                    </div>
                                )}
                                {selected.ageMinutes !== undefined && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Seated</span>
                                        <span className="font-bold tabular-nums text-licorice">{selected.ageMinutes}m</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-isabelline pb-1.5">
                                    <span className="font-medium tracking-tight text-feldgrau">Server</span>
                                    <span className={`font-bold ${selected.waiterName ? "text-licorice" : "text-feldgrau/70 italic"}`}>
                                        {selected.waiterName || "Unassigned"}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowQrFor(selected)}
                                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.98]"
                            >
                                <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Generate QR Code
                            </button>

                            {selected.status === "occupied" && selected.billId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setClosingTable(selected);
                                        setClosingLoading(true);
                                        db.orderItemsByBill(selected.billId!).then((res) => {
                                            setClosingItems(res.data);
                                            setClosingLoading(false);
                                        });
                                    }}
                                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold tracking-tight text-dark-red ring-1 ring-dark-red/20 shadow-sm transition-all hover:bg-dark-red/5 active:scale-[0.98]"
                                >
                                    End Session
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-licorice/10 px-4 py-10 text-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-feldgrau">Select a table</p>
                            <p className="mt-1 text-xs tracking-tight text-feldgrau/70">Tap any table on the floorplan</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Active Table Orders ── */}
            {selected && (
                selected.billId ? (
                    <TableActiveOrders billId={selected.billId} />
                ) : (
                    <div className="mt-6 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-licorice/10 bg-white px-4 py-10 text-center shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-licorice/20" />
                        <p className="mt-4 text-sm font-bold uppercase tracking-wider text-feldgrau">Table Available</p>
                        <p className="mt-1 text-xs tracking-tight text-feldgrau/70">
                            This table is currently empty. No active orders.
                        </p>
                    </div>
                )
            )}

            {/* ── QR Modal ── */}
            {showQrFor && (
                <PrintableQrModal
                    isOpen={Boolean(showQrFor)}
                    onClose={() => setShowQrFor(null)}
                    tableNumber={showQrFor.table_number}
                    tableLabel={showQrFor.table_label}
                    area={showQrFor.area}
                    venueName={venue?.name || "VELVET LOUNGE"}
                    qrCodeToken={showQrFor.qr_code_token}
                />
            )}

            {/* ── End Session Modal ── */}
            <ConfirmModal
                isOpen={!!closingTable}
                title="End Table Session"
                body={
                    closingLoading && !closingItems ? (
                        "Loading..."
                    ) : (
                        <div className="space-y-3">
                            <p>Are you sure you want to force close this table?</p>
                            <div className="rounded-lg bg-red-50 p-3 text-dark-red space-y-1">
                                <p className="font-bold">
                                    Outstanding Tab: {formatGHS(closingTable?.tabTotal ?? 0)}
                                </p>
                                {(closingItems?.filter(i => ['pending', 'confirmed', 'preparing'].includes(i.status)).length ?? 0) > 0 && (
                                    <p className="font-bold">
                                        {closingItems!.filter(i => ['pending', 'confirmed', 'preparing'].includes(i.status)).length} items still unfulfilled
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                }
                confirmLabel="Force Close Table"
                cancelLabel="Cancel"
                isDanger
                swapButtons
                loading={closingLoading && !!closingItems}
                onConfirm={async () => {
                    if (!closingTable?.id) return;
                    setClosingLoading(true);
                    await db.cancelTableSession(closingTable.id);
                    setClosingTable(null);
                    setClosingItems(null);
                    setSelectedId(null);
                    setClosingLoading(false);
                    fetchData();
                }}
                onClose={() => {
                    setClosingTable(null);
                    setClosingItems(null);
                }}
            />

            {/* ── Add Table / Area Modal ── */}
            {addModalOpen && (
                <AddTableModal
                    venueId={venue.id}
                    existingAreas={areas}
                    existingTables={tables}
                    maxTableNum={tables.length > 0 ? Math.max(...tables.map((t) => t.table_number)) : 0}
                    onCreated={(newId) => {
                        setSelectedId(newId);
                        fetchData();
                    }}
                    onClose={() => setAddModalOpen(false)}
                />
            )}

            {/* ── Edit Table Modal ── */}
            {editingTable && (
                <EditTableModal
                    table={editingTable}
                    venueId={venue.id}
                    existingAreas={areas}
                    existingTables={tables}
                    onSaved={() => {
                        fetchData();
                    }}
                    onDeleteRequest={() => {
                        setDeletingTable(editingTable);
                        setEditingTable(null);
                    }}
                    onClose={() => setEditingTable(null)}
                />
            )}

            {/* ── Delete Table Confirm Modal ── */}
            <ConfirmModal
                isOpen={!!deletingTable}
                title={`Delete Table ${deletingTable ? String(deletingTable.table_number).padStart(2, "0") : ""}?`}
                body={`Are you sure you want to remove Table ${deletingTable ? String(deletingTable.table_number).padStart(2, "0") : ""} from ${deletingTable?.area}? Customers will no longer be able to scan or open tabs on this table.`}
                confirmLabel="Delete Table"
                cancelLabel="Cancel"
                isDanger
                swapButtons
                onConfirm={async () => {
                    if (!deletingTable?.id) return;
                    const { data: ok } = await db.deleteTable(deletingTable.id, venue.id);
                    if (ok) {
                        toast.success(`Table ${String(deletingTable.table_number).padStart(2, "0")} deleted.`);
                        setSelectedId(null);
                        setDeletingTable(null);
                        fetchData();
                    } else {
                        toast.error("Could not delete table.");
                        setDeletingTable(null);
                    }
                }}
                onClose={() => setDeletingTable(null)}
            />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT TABLE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function EditTableModal({
    table,
    venueId,
    existingAreas,
    existingTables = [],
    onSaved,
    onDeleteRequest,
    onClose,
}: {
    table: FloorTable;
    venueId: string;
    existingAreas: string[];
    existingTables?: FloorTable[];
    onSaved: () => void;
    onDeleteRequest?: () => void;
    onClose: () => void;
}) {
    const defaultAreas = Array.from(new Set(["Main Hall", "VIP Lounge", "Bar", "Outdoor", "Private", ...existingAreas]));
    const [tableNumber, setTableNumber] = useState<number>(table.table_number);
    const [selectedArea, setSelectedArea] = useState<string>(
        defaultAreas.includes(table.area) ? table.area : "__custom__"
    );
    const [customArea, setCustomArea] = useState<string>(
        defaultAreas.includes(table.area) ? "" : table.area
    );
    const [capacity, setCapacity] = useState<number>(table.capacity);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        const areaToUse = selectedArea === "__custom__" ? customArea.trim() : selectedArea;
        if (!areaToUse) {
            setError("Please select or enter a seating area.");
            return;
        }
        if (!tableNumber || tableNumber <= 0) {
            setError("Please enter a valid table number.");
            return;
        }
        if (existingTables.some((t) => t.id !== table.id && t.table_number === tableNumber)) {
            setError(`Table number ${tableNumber} already exists. Please choose a different number.`);
            return;
        }
        if (!capacity || capacity <= 0) {
            setError("Please enter a valid capacity.");
            return;
        }

        setError(null);
        setSaving(true);
        const { data, error: err } = await db.updateTable(table.id, venueId, {
            tableNumber,
            capacity,
            area: areaToUse,
        });
        setSaving(false);

        if (err || !data) {
            setError(err?.message || "Could not update table.");
            return;
        }

        toast.success(`Table ${String(tableNumber).padStart(2, "0")} updated!`);
        onSaved();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">Edit Table {String(table.table_number).padStart(2, "0")}</h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Table Number</label>
                            <input
                                type="number"
                                min={1}
                                value={tableNumber === 0 ? "" : tableNumber}
                                onChange={(e) => setTableNumber(e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[13px] font-bold tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Capacity (Seats)</label>
                            <input
                                type="number"
                                min={1}
                                value={capacity === 0 ? "" : capacity}
                                onChange={(e) => setCapacity(e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[13px] font-bold tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Seating Area</label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {defaultAreas.map((areaName) => (
                                <button
                                    key={areaName}
                                    type="button"
                                    onClick={() => setSelectedArea(areaName)}
                                    className={clsx(
                                        "rounded-lg py-2 px-3 text-left text-xs font-bold tracking-tight transition-all active:scale-95",
                                        selectedArea === areaName ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {areaName}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSelectedArea("__custom__")}
                                className={clsx(
                                    "rounded-lg py-2 px-3 text-left text-xs font-bold tracking-tight transition-all active:scale-95 border-dashed border border-licorice/20",
                                    selectedArea === "__custom__" ? "bg-licorice text-isabelline shadow-sm border-solid" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                )}
                            >
                                + New Area…
                            </button>
                        </div>

                        {selectedArea === "__custom__" && (
                            <div className="mt-2.5">
                                <label className="text-[11px] font-bold uppercase text-feldgrau/70">Custom Area Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={customArea}
                                    onChange={(e) => setCustomArea(e.target.value)}
                                    placeholder="e.g. Rooftop, Terrace, Patio…"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                                />
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold tracking-tight text-red-700">{error}</p>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-isabelline px-5 py-3">
                    {onDeleteRequest ? (
                        <button
                            type="button"
                            onClick={onDeleteRequest}
                            disabled={table.status === "occupied"}
                            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold tracking-tight text-dark-red ring-1 ring-dark-red/20 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-40"
                            title={table.status === "occupied" ? "Cannot delete occupied table" : "Delete table"}
                        >
                            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Delete Table
                        </button>
                    ) : <div />}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || (selectedArea === "__custom__" && !customArea.trim())}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        {saving ? "Saving…" : (
                            <>
                                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD TABLE / AREA MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function AddTableModal({
    venueId,
    existingAreas,
    existingTables = [],
    maxTableNum,
    onCreated,
    onClose,
}: {
    venueId: string;
    existingAreas: string[];
    existingTables?: FloorTable[];
    maxTableNum: number;
    onCreated: (newTableId: string) => void;
    onClose: () => void;
}) {
    const defaultAreas = Array.from(new Set(["Main Hall", "VIP Lounge", "Bar", "Outdoor", "Private", ...existingAreas]));
    const [tableNumber, setTableNumber] = useState<number>(maxTableNum + 1);
    const [selectedArea, setSelectedArea] = useState<string>(defaultAreas[0]);
    const [customArea, setCustomArea] = useState<string>("");
    const [capacity, setCapacity] = useState<number>(4);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        const areaToUse = selectedArea === "__custom__" ? customArea.trim() : selectedArea;
        if (!areaToUse) {
            setError("Please select or enter a seating area.");
            return;
        }
        if (!tableNumber || tableNumber <= 0) {
            setError("Please enter a valid table number.");
            return;
        }
        if (existingTables.some((t) => t.table_number === tableNumber)) {
            setError(`Table number ${tableNumber} already exists in this venue. Please choose a different number.`);
            return;
        }
        if (!capacity || capacity <= 0) {
            setError("Please enter a valid capacity.");
            return;
        }

        setError(null);
        setSaving(true);
        const { data, error: err } = await db.createTable({
            venueId,
            tableNumber,
            capacity,
            area: areaToUse,
            tableLabel: `Table ${String(tableNumber).padStart(2, "0")}`,
        });
        setSaving(false);

        if (err || !data) {
            setError(err?.message || "Could not create table. Table number may already exist.");
            return;
        }

        toast.success(`Table ${String(tableNumber).padStart(2, "0")} added to ${areaToUse}!`);
        onCreated(data.id);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">Add New Table / Area</h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Table Number</label>
                            <input
                                type="number"
                                min={1}
                                value={tableNumber === 0 ? "" : tableNumber}
                                onChange={(e) => setTableNumber(e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[13px] font-bold tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Capacity (Seats)</label>
                            <input
                                type="number"
                                min={1}
                                value={capacity === 0 ? "" : capacity}
                                onChange={(e) => setCapacity(e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[13px] font-bold tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Seating Area</label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {defaultAreas.map((areaName) => (
                                <button
                                    key={areaName}
                                    type="button"
                                    onClick={() => setSelectedArea(areaName)}
                                    className={clsx(
                                        "rounded-lg py-2 px-3 text-left text-xs font-bold tracking-tight transition-all active:scale-95",
                                        selectedArea === areaName ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {areaName}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSelectedArea("__custom__")}
                                className={clsx(
                                    "rounded-lg py-2 px-3 text-left text-xs font-bold tracking-tight transition-all active:scale-95 border-dashed border border-licorice/20",
                                    selectedArea === "__custom__" ? "bg-licorice text-isabelline shadow-sm border-solid" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                )}
                            >
                                + New Area…
                            </button>
                        </div>

                        {selectedArea === "__custom__" && (
                            <div className="mt-2.5">
                                <label className="text-[11px] font-bold uppercase text-feldgrau/70">Custom Area Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={customArea}
                                    onChange={(e) => setCustomArea(e.target.value)}
                                    placeholder="e.g. Rooftop, Terrace, Patio…"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                                />
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold tracking-tight text-red-700">{error}</p>
                    )}
                </div>

                <div className="flex items-center justify-end border-t border-isabelline px-5 py-3">
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving || (selectedArea === "__custom__" && !customArea.trim())}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        {saving ? "Creating…" : (
                            <>
                                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                Create Table
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
