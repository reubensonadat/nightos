import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDownTrayIcon,
    ClockIcon,
    LinkIcon,
    UserGroupIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import QRCode from "qrcode";
import { formatGHS } from "../../data/menu";
import { db, type DbTable } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import { useRealtime } from "../../hooks/useRealtime";
import { ConfirmModal } from "../../components/ConfirmModal";

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
                // eslint-disable-next-line react-hooks/refs
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
            const [tablesResult, billsResult] = await Promise.all([
                db.tablesByVenue(venue.id),
                db.billsByVenue(venue.id, 0, 500),
            ]);
            if (tablesResult.error) throw tablesResult.error;
            const allBills = billsResult.data ?? [];
            const activeBills = allBills.filter((b) => b.status === 'open' || b.status === 'settling');
            
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
                        waiterName: bill.waiter_id ? waiterNamesRef.current[bill.waiter_id] ?? null : null,
                    };
                }
                return { ...t, status: "available" as const };
            });
            setTables(rows);

            const waiterIds = [
                ...new Set(
                    activeBills
                        .map((b) => b.waiter_id)
                        .filter((id): id is string => typeof id === "string" && id.length > 0),
                ),
            ];
            if (waiterIds.length > 0) {
                const { data: staffRows } = await db.staffNamesByIds(waiterIds);
                const names = Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.name]));
                waiterNamesRef.current = names;
                setTables((prev) =>
                    prev.map((t) => {
                        const bill = billMap.get(t.id);
                        return bill?.waiter_id
                            ? { ...t, waiterName: names[bill.waiter_id] ?? null }
                            : t;
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
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tables</h2>
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
                    <p className="text-xs font-bold uppercase text-feldgrau">Table Details</p>
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
                                {selected.waiterName && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Server</span>
                                        <span className="font-bold text-licorice">{selected.waiterName}</span>
                                    </div>
                                )}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-licorice/50 backdrop-blur-sm"
                        onClick={() => setShowQrFor(null)}
                    />
                    <div className="relative w-full max-w-sm overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                            <div>
                                <p className="text-xs font-bold uppercase text-feldgrau">QR Code</p>
                                <h3 className="text-[14px] font-bold tracking-tight text-licorice">
                                    Table {String(showQrFor.table_number).padStart(2, "0")} · {showQrFor.area}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowQrFor(null)}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                            >
                                <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center px-5 py-6">
                            <RealQrCode url={qrUrlFor(showQrFor)} size={200} />
                            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-feldgrau">Scan to order</p>
                            <p className="mt-0.5 break-all text-center text-xs tracking-tight text-feldgrau/70">
                                {qrUrlFor(showQrFor)}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-isabelline p-3">
                            <button
                                type="button"
                                onClick={() => handleDownloadQr(showQrFor)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-isabelline px-4 py-2.5 text-xs font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95"
                            >
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Download PNG
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopyLink(showQrFor)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-xs font-bold tracking-tight text-isabelline active:scale-95"
                            >
                                <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                {copied ? "Copied!" : "Copy Link"}
                            </button>
                        </div>
                    </div>
                </div>
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
        </div>
    );
}
