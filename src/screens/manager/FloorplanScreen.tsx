import { useState } from "react";
import {
    ArrowDownTrayIcon,
    PlusIcon,
    QrCodeIcon,
    UserGroupIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";

/* ────────────────────────── Types & mock data ────────────────────────── */

type TableLayout = {
    id: string;
    number: number;
    capacity: number;
    status: "available" | "occupied" | "reserved";
    area: "Window" | "Bar" | "Lounge" | "VIP";
    x: number; // grid column position (1-6)
    y: number; // grid row position (1-4)
    guests?: number;
    tabTotal?: number;
};

const MOCK_TABLES: TableLayout[] = [
    { id: "t01", number: 1, capacity: 2, status: "available", area: "Window", x: 1, y: 1 },
    { id: "t02", number: 2, capacity: 2, status: "occupied", area: "Window", x: 2, y: 1, guests: 2, tabTotal: 245 },
    { id: "t03", number: 3, capacity: 4, status: "reserved", area: "Window", x: 3, y: 1 },
    { id: "t04", number: 4, capacity: 2, status: "occupied", area: "Bar", x: 5, y: 1, guests: 1, tabTotal: 95 },
    { id: "t05", number: 5, capacity: 4, status: "available", area: "Bar", x: 6, y: 1 },
    { id: "t06", number: 6, capacity: 6, status: "occupied", area: "Lounge", x: 1, y: 3, guests: 6, tabTotal: 480 },
    { id: "t07", number: 7, capacity: 4, status: "available", area: "Lounge", x: 3, y: 3 },
    { id: "t08", number: 8, capacity: 4, status: "occupied", area: "VIP", x: 5, y: 3, guests: 3, tabTotal: 180 },
];

/* ────────────────────────── QR Placeholder ────────────────────────── */

function QrCode({ size = 160, tableNum }: { size?: number; tableNum: number }) {
    const cells = 13;
    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-xl bg-white p-3 ring-1 ring-licorice/10"
            style={{ width: size, height: size }}
        >
            <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cells}, 1fr)` }}>
                {Array.from({ length: cells * cells }).map((_, i) => {
                    const row = Math.floor(i / cells);
                    const col = i % cells;
                    // Deterministic pattern based on table number for visual variety
                    const filled = ((i * (tableNum + 7) + 13) % 11) % 3 !== 0;
                    // Corner markers
                    const isCorner =
                        (row < 3 && col < 3) ||
                        (row < 3 && col >= cells - 3) ||
                        (row >= cells - 3 && col < 3);
                const isCornerEdge =
                isCorner &&
                (row === 0 || row === 2 || col === 0 || col === 2 ||
                row === cells - 1 || row === cells - 3 ||
                col === cells - 1 || col === cells - 3);
                return (
                <div
                    key={i}
                    className={
                        isCorner
                            ? isCornerEdge
                                ? "bg-licorice"
                                : "bg-transparent"
                            : filled
                                ? "bg-licorice"
                                : "bg-transparent"
                    }
                />
                );
                })}
            </div>
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

export function FloorplanScreen() {
    const [selected, setSelected] = useState<TableLayout | null>(null);
    const [showQrFor, setShowQrFor] = useState<TableLayout | null>(null);

    const occupiedCount = MOCK_TABLES.filter((t) => t.status === "occupied").length;
    const totalCapacity = MOCK_TABLES.reduce((sum, t) => sum + t.capacity, 0);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Header summary ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Tables</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{MOCK_TABLES.length}</p>
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
                    <p className="mt-1 text-[14px] font-bold tracking-tight text-licorice">Window · Bar · Lounge · VIP</p>
                </div>
            </div>

            {/* ── Floorplan + Details ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Floorplan grid */}
                <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Floorplan</p>
                            <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Visual layout</h3>
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-3 py-1.5 text-[10px] font-bold tracking-tight text-isabelline shadow-sm active:scale-95"
                        >
                            <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                            Add Table
                        </button>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1 text-feldgrau">
                            <span className="h-2 w-2 rounded-full bg-feldgrau" /> Available
                        </span>
                        <span className="inline-flex items-center gap-1 text-khaki">
                            <span className="h-2 w-2 rounded-full bg-khaki" /> Occupied
                        </span>
                        <span className="inline-flex items-center gap-1 text-light-blue">
                            <span className="h-2 w-2 rounded-full bg-light-blue" /> Reserved
                        </span>
                    </div>

                    {/* Grid */}
                    <div
                        className="mt-5 grid gap-2"
                        style={{
                            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                            gridTemplateRows: "repeat(4, 80px)",
                        }}
                    >
                        {/* Area labels */}
                        <div className="col-span-4 row-start-1 flex items-center px-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau/60">Window</span>
                        </div>
                        <div className="col-span-2 row-start-1 flex items-center px-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau/60">Bar</span>
                        </div>
                        <div className="col-span-3 col-start-1 row-start-3 flex items-center px-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau/60">Lounge</span>
                        </div>
                        <div className="col-span-2 col-start-5 row-start-3 flex items-center px-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau/60">VIP</span>
                        </div>

                        {/* Tables */}
                        {MOCK_TABLES.map((table) => {
                            const isSelected = selected?.id === table.id;
                            const statusColor =
                                table.status === "available"
                                    ? "bg-white border-feldgrau/30 text-licorice hover:border-feldgrau"
                                    : table.status === "occupied"
                                        ? "bg-khaki/15 border-khaki text-licorice"
                                        : "bg-light-blue/15 border-light-blue text-licorice";
                            return (
                                <button
                                    key={table.id}
                                    type="button"
                                    onClick={() => setSelected(table)}
                                    style={{ gridColumn: table.x, gridRow: table.y }}
                                    className={`
                                        flex flex-col items-center justify-center rounded-xl border-2 p-1
                                        transition-all duration-150 active:scale-95
                                        ${statusColor}
                                        ${isSelected ? "ring-2 ring-licorice ring-offset-2 ring-offset-white" : ""}
                                    `}
                                >
                                    <span className="font-serif text-[18px] font-black leading-none tracking-[-0.04em]">
                                        {String(table.number).padStart(2, "0")}
                                    </span>
                                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider opacity-70">
                                        <UserGroupIcon className="h-2 w-2" strokeWidth={2.5} />
                                        {table.capacity}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Details panel */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Table Details</p>
                    {selected ? (
                        <div className="mt-4">
                            <div className="flex items-baseline gap-3">
                                <span className="font-serif text-[40px] font-black leading-none tracking-[-0.04em] text-licorice">
                                    {String(selected.number).padStart(2, "0")}
                                </span>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">{selected.area}</p>
                                    <p className="text-[11px] font-medium tracking-tight text-licorice">Capacity: {selected.capacity}</p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2 text-[11px]">
                                <div className="flex justify-between border-b border-isabelline pb-1.5">
                                    <span className="font-medium tracking-tight text-feldgrau">Status</span>
                                    <span className="font-bold uppercase tracking-wider text-licorice">{selected.status}</span>
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
                            </div>

                            {/* QR button */}
                            <button
                                type="button"
                                onClick={() => setShowQrFor(selected)}
                                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.98]"
                            >
                                <QrCodeIcon className="h-3.5 w-3.5" strokeWidth={2} />
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
                                    Table {String(showQrFor.number).padStart(2, "0")} · {showQrFor.area}
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
                            <QrCode size={200} tableNum={showQrFor.number} />
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-feldgrau">Scan to order</p>
                            <p className="mt-0.5 text-[10px] tracking-tight text-feldgrau/70">velvetlounge.gh/t/{showQrFor.number}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-isabelline p-3">
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-isabelline px-4 py-2.5 text-[11px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95"
                            >
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Download PNG
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-[11px] font-bold tracking-tight text-isabelline active:scale-95"
                            >
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Print Label
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
