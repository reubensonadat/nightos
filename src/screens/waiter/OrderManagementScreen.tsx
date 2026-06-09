import { useState, useMemo } from "react";
import {
    ArrowLeftIcon,
    CheckIcon,
    MinusIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import { MENU, formatGHS, type MenuItem, type MenuCategory } from "../../data/menu";
import type { Table } from "./TablesDashboard";

/* ────────────────────────── Types ────────────────────────── */

type OrderLine = {
    lineId: string;
    menuItem: MenuItem;
    quantity: number;
    notes?: string;
};

type Tab = "order" | "add";

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    table: Table;
    onBack: () => void;
    onGoToTableOps: () => void;
    onGoToInvoice: () => void;
};

export function OrderManagementScreen({ table, onBack, onGoToTableOps, onGoToInvoice }: Props) {
    const [tab, setTab] = useState<Tab>("order");
    const [order, setOrder] = useState<OrderLine[]>([
        // Seed with a mock existing order for occupied tables
        ...(table.status === "occupied"
            ? [
                {
                    lineId: "l1",
                    menuItem: MENU[0], // First signature item
                    quantity: 2,
                    notes: "One with no ice",
                },
                {
                    lineId: "l2",
                    menuItem: MENU.find((m) => m.category === "Small Plates") ?? MENU[0],
                    quantity: 1,
                },
            ]
            : []),
    ]);
    const [activeCategory, setActiveCategory] = useState<MenuCategory>("Signatures");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteDraft, setNoteDraft] = useState("");
    const [sentFlash, setSentFlash] = useState(false);

    const categories = useMemo(
        () => Array.from(new Set(MENU.map((m) => m.category))) as MenuCategory[],
        []
    );

    const filteredMenu = useMemo(
        () => MENU.filter((m) => m.category === activeCategory),
        [activeCategory]
    );

    const subtotal = useMemo(
        () => order.reduce((sum, line) => sum + line.menuItem.price * line.quantity, 0),
        [order]
    );

    const itemCount = useMemo(
        () => order.reduce((sum, line) => sum + line.quantity, 0),
        [order]
    );

    /* ── Order mutations ── */

    const addToOrder = (item: MenuItem) => {
        setOrder((prev) => {
            const existing = prev.find((line) => line.menuItem.id === item.id && !line.notes);
            if (existing) {
                return prev.map((line) =>
                    line.lineId === existing.lineId ? { ...line, quantity: line.quantity + 1 } : line
                );
            }
            return [
                ...prev,
                { lineId: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, menuItem: item, quantity: 1 },
            ];
        });
    };

    const incrementQty = (lineId: string) => {
        setOrder((prev) =>
            prev.map((line) =>
                line.lineId === lineId ? { ...line, quantity: line.quantity + 1 } : line
            )
        );
    };

    const decrementQty = (lineId: string) => {
        setOrder((prev) =>
            prev
                .map((line) =>
                    line.lineId === lineId ? { ...line, quantity: line.quantity - 1 } : line
                )
                .filter((line) => line.quantity > 0)
        );
    };

    const removeLine = (lineId: string) => {
        setOrder((prev) => prev.filter((line) => line.lineId !== lineId));
    };

    const startEditNote = (line: OrderLine) => {
        setEditingNoteId(line.lineId);
        setNoteDraft(line.notes ?? "");
    };

    const saveNote = () => {
        if (!editingNoteId) return;
        setOrder((prev) =>
            prev.map((line) =>
                line.lineId === editingNoteId ? { ...line, notes: noteDraft.trim() || undefined } : line
            )
        );
        setEditingNoteId(null);
        setNoteDraft("");
    };

    const sendToKitchen = () => {
        if (order.length === 0) return;
        setSentFlash(true);
        window.setTimeout(() => setSentFlash(false), 2500);
    };

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to tables"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            Table {String(table.number).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            Order Management
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onGoToTableOps}
                            aria-label="Table operations"
                            className="rounded-full bg-white px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-feldgrau shadow-sm ring-1 ring-licorice/8 transition-colors hover:text-licorice active:scale-95"
                        >
                            Ops
                        </button>
                        <button
                            type="button"
                            onClick={onGoToInvoice}
                            aria-label="Settle bill"
                            className="rounded-full bg-licorice px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-isabelline shadow-sm transition-colors hover:bg-licorice/90 active:scale-95"
                        >
                            Bill
                        </button>
                    </div>
                </div>

                {/* Tab bar */}
                <nav className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3">
                    <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-licorice/8">
                        <button
                            type="button"
                            onClick={() => setTab("order")}
                            className={`flex-1 rounded-full py-2 text-[12px] font-bold tracking-tight transition-all duration-200 ${tab === "order"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:text-licorice"
                                }`}
                        >
                            Current Order
                            {itemCount > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-khaki/30 px-1.5 py-0.5 text-[8px] font-bold tabular-nums">
                                    {itemCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("add")}
                            className={`flex-1 rounded-full py-2 text-[12px] font-bold tracking-tight transition-all duration-200 ${tab === "add"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:text-licorice"
                                }`}
                        >
                            Add Items
                        </button>
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-7xl flex-1 px-5 md:px-8 pt-5 pb-[120px]">
                {/* ── CURRENT ORDER TAB ── */}
                {tab === "order" && (
                    <div className="animate-velvet-fade">
                        {order.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                                <span className="h-1.5 w-1.5 rounded-full bg-khaki" />
                                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                                    No items yet
                                </h3>
                                <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                    Switch to <strong>Add Items</strong> to start the order.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setTab("add")}
                                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] active:scale-95"
                                >
                                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    Add Items
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {order.map((line, idx) => (
                                    <div
                                        key={line.lineId}
                                        className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_14px_rgba(35,20,12,0.05)] ring-1 ring-isabelline"
                                        style={{ animationDelay: `${Math.min(idx * 30, 180)}ms` }}
                                    >
                                        <div className="flex items-start gap-3 px-3.5 py-3">
                                            {/* Item image */}
                                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-isabelline">
                                                <img
                                                    src={line.menuItem.image}
                                                    alt={line.menuItem.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h4 className="truncate text-[13px] font-bold tracking-tight text-licorice">
                                                            {line.menuItem.name}
                                                        </h4>
                                                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-feldgrau">
                                                            {line.menuItem.category}
                                                        </p>
                                                    </div>
                                                    <p className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                                                        {formatGHS(line.menuItem.price * line.quantity)}
                                                    </p>
                                                </div>

                                                {/* Notes */}
                                                {editingNoteId === line.lineId ? (
                                                    <div className="mt-2">
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            value={noteDraft}
                                                            onChange={(e) => setNoteDraft(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") saveNote();
                                                                if (e.key === "Escape") setEditingNoteId(null);
                                                            }}
                                                            placeholder="e.g. no ice, allergy: nuts"
                                                            className="w-full rounded-lg bg-isabelline px-2.5 py-1.5 text-[11px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/10 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                                                        />
                                                        <div className="mt-1.5 flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={saveNote}
                                                                className="text-[10px] font-bold uppercase tracking-wider text-khaki hover:text-licorice"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingNoteId(null)}
                                                                className="text-[10px] font-bold uppercase tracking-wider text-feldgrau hover:text-dark-red"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : line.notes ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditNote(line)}
                                                        className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-khaki/12 px-2 py-0.5 text-[10px] font-medium tracking-tight text-khaki hover:bg-khaki/20"
                                                    >
                                                        <PencilSquareIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                                        {line.notes}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditNote(line)}
                                                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-tight text-feldgrau hover:text-licorice"
                                                    >
                                                        <PlusIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                                        Add note
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom row: qty controls + remove */}
                                        <div className="flex items-center justify-between border-t border-isabelline px-3.5 py-2">
                                            <button
                                                type="button"
                                                onClick={() => removeLine(line.lineId)}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-feldgrau transition-colors hover:text-dark-red"
                                            >
                                                <TrashIcon className="h-3 w-3" strokeWidth={2.25} />
                                                Remove
                                            </button>
                                            <div className="flex items-center gap-1.5 rounded-full bg-isabelline p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => decrementQty(line.lineId)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-licorice shadow-sm transition-all active:scale-90"
                                                >
                                                    <MinusIcon className="h-3 w-3" strokeWidth={2.5} />
                                                </button>
                                                <span className="w-6 text-center font-mono text-[12px] font-bold tabular-nums text-licorice">
                                                    {line.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => incrementQty(line.lineId)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-licorice text-isabelline transition-all active:scale-90"
                                                >
                                                    <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ADD ITEMS TAB ── */}
                {tab === "add" && (
                    <div className="animate-velvet-fade">
                        {/* Category pills */}
                        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
                            {categories.map((cat) => {
                                const isActive = cat === activeCategory;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setActiveCategory(cat)}
                                        className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${isActive
                                            ? "bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]"
                                            : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Items grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                            {filteredMenu.map((item, idx) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => addToOrder(item)}
                                    className="
                                        animate-velvet-rise
                                        group flex flex-col overflow-hidden rounded-2xl bg-white
                                        shadow-[0_4px_14px_rgba(35,20,12,0.05)]
                                        ring-1 ring-isabelline
                                        transition-all duration-200
                                        hover:shadow-[0_12px_28px_rgba(35,20,12,0.10)]
                                        hover:ring-khaki/30
                                        active:scale-[0.98]
                                        text-left
                                    "
                                    style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
                                >
                                    <div className="relative h-24 w-full overflow-hidden bg-isabelline">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.25)] opacity-0 transition-opacity group-hover:opacity-100">
                                            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col justify-between p-3">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                                {item.category}
                                            </p>
                                            <h4 className="mt-0.5 line-clamp-1 text-[12.5px] font-bold tracking-tight text-licorice">
                                                {item.name}
                                            </h4>
                                        </div>
                                        <p className="mt-2 font-mono text-[12px] font-bold tabular-nums text-licorice">
                                            {formatGHS(item.price)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 bg-isabelline/95 backdrop-blur-xl border-t border-licorice/8">
                <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                    {/* Subtotal */}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                            Subtotal
                        </span>
                        <span className="font-mono text-[16px] font-black tabular-nums text-licorice">
                            {formatGHS(subtotal)}
                        </span>
                    </div>

                    {/* Send to Kitchen */}
                    <button
                        type="button"
                        onClick={sendToKitchen}
                        disabled={order.length === 0 || sentFlash}
                        className={`
                            ml-auto inline-flex items-center justify-center gap-1.5
                            rounded-full px-5 py-3
                            text-[12px] font-bold tracking-tight
                            transition-all duration-200 active:scale-[0.98]
                            ${sentFlash
                                ? "bg-khaki/20 text-khaki"
                                : "bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95 disabled:opacity-40 disabled:shadow-none"
                            }
                        `}
                    >
                        {sentFlash ? (
                            <>
                                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                Sent to Kitchen
                            </>
                        ) : (
                            <>Send to Kitchen</>
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}
