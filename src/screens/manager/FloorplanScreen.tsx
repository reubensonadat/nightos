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

/* ────────────────────────── Types ────────────────────────── */

type FloorTable = DbTable & {
    status: "available" | "occupied";
    guests?: number;
    tabTotal?: number;
    seatedAt?: string;
    waiterName?: string | null;
    ageMinutes?: number;
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

/* ────────────────────────── Component ────────────────────────── */

export function FloorplanScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<FloorTable | null>(null);
    const [showQrFor, setShowQrFor] = useState<FloorTable | null>(null);
    const [copied, setCopied] = useState(false);
    const reloadTimer = useRef<number | null>(null);
    const waiterNamesRef = useRef<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        try {
            const [tablesResult, billsResult] = await Promise.all([
                db.tablesByVenue(venue.id),
                db.billsByVenue(venue.id),
            ]);
            if (tablesResult.error) throw tablesResult.error;
            const billRows = billsResult.data ?? [];
            const billMap = new Map(billRows.map((b) => [b.table_id, b]));

            const rows: FloorTable[] = (tablesResult.data ?? []).map((t) => {
                const bill = billMap.get(t.id);
                if (bill) {
                    return {
                        ...t,
                        status: "occupied" as const,
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
                    billRows
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
        `${window.location.origin}${window.location.pathname}#/?table=${encodeURIComponent(t.qr_code_token)}`;

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
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Tables</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{tables.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Occupied</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{occupiedCount}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Capacity</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalCapacity}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Areas</p>
                    <p className="mt-1 text-[14px] font-bold tracking-tight text-licorice">
                        {areas.length > 0 ? areas.join(" · ") : "—"}
                    </p>
                </div>
            </div>

            {/* ── Floorplan + Details ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Floorplan grid */}
                <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Floorplan</p>
                        <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Live table layout</h3>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1 text-feldgrau">
                            <span className="h-2 w-2 rounded-full bg-feldgrau" /> Available
                        </span>
                        <span className="inline-flex items-center gap-1 text-khaki">
                            <span className="h-2 w-2 rounded-full bg-khaki" /> Occupied
                        </span>
                    </div>

                    {loading ? (
                        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-isabelline px-6 py-16 text-center">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                            <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Loading tables…</p>
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-isabelline px-6 py-16 text-center">
                            <p className="text-[12px] font-bold tracking-tight text-feldgrau">No tables yet</p>
                            <p className="mt-1 text-[11px] tracking-tight text-feldgrau/70">
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
                                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau/60">
                                            {area}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                                            {areaTables.map((table) => {
                                                const isSelected = selected?.id === table.id;
                                                const statusColor =
                                                    table.status === "available"
                                                        ? "bg-white border-feldgrau/30 text-licorice hover:border-feldgrau"
                                                        : "bg-khaki/15 border-khaki text-licorice";
                                                return (
                                                    <button
                                                        key={table.id}
                                                        type="button"
                                                        onClick={() => setSelected(table)}
                                                        className={`
                                                            flex flex-col items-center justify-center rounded-xl border-2 p-3
                                                            transition-all duration-150 active:scale-95
                                                            ${statusColor}
                                                            ${isSelected ? "ring-2 ring-licorice ring-offset-2 ring-offset-white" : ""}
                                                        `}
                                                    >
                                                        <span className="font-serif text-[18px] font-black leading-none tracking-[-0.04em]">
                                                            {String(table.table_number).padStart(2, "0")}
                                                        </span>
                                                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider opacity-70">
                                                            <UserGroupIcon className="h-2 w-2" strokeWidth={2.5} />
                                                            {table.capacity}
                                                        </span>
                                                        {table.status === "occupied" && (
                                                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-khaki/20 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-khaki">
                                                                <ClockIcon className="h-2 w-2" strokeWidth={2.5} />
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
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Table Details</p>
                    {selected ? (
                        <div className="mt-4">
                            <div className="flex items-baseline gap-3">
                                <span className="font-serif text-[40px] font-black leading-none tracking-[-0.04em] text-licorice">
                                    {String(selected.table_number).padStart(2, "0")}
                                </span>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">{selected.area}</p>
                                    <p className="text-[11px] font-medium tracking-tight text-licorice">Capacity: {selected.capacity}</p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2 text-[11px]">
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
                                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.98]"
                            >
                                <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Generate QR Code
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-licorice/10 px-4 py-10 text-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                            <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-feldgrau">Select a table</p>
                            <p className="mt-1 text-[10px] tracking-tight text-feldgrau/70">Tap any table on the floorplan</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── QR Modal ── */}
            {showQrFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-licorice/50 backdrop-blur-sm"
                        onClick={() => setShowQrFor(null)}
                    />
                    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">QR Code</p>
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
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-feldgrau">Scan to order</p>
                            <p className="mt-0.5 break-all text-center text-[10px] tracking-tight text-feldgrau/70">
                                {qrUrlFor(showQrFor)}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-isabelline p-3">
                            <button
                                type="button"
                                onClick={() => handleDownloadQr(showQrFor)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-isabelline px-4 py-2.5 text-[11px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95"
                            >
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Download PNG
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopyLink(showQrFor)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-[11px] font-bold tracking-tight text-isabelline active:scale-95"
                            >
                                <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                {copied ? "Copied!" : "Copy Link"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
