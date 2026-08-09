import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "../../hooks/useRealtime";
import {
    ArrowLeftIcon,
    CheckIcon,
    PlusIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbOrderSubmission, type DbOrderItem, type DbProduct, type DbMenuCategory } from "../../lib/api";
import type { Table } from "./TablesDashboard";
import { MenuItemCard } from "../../components/MenuItemCard";

/* ────────────────────────── Types ────────────────────────── */

type OrderLine = {
    lineId: string;
    menuItem: WItem;
    quantity: number;
    notes?: string;
};

/** Product from the DB, joined with its category name. */
type WItem = {
    id: string;
    name: string;
    categoryId: string;
    category: string;
    price: number;
    image: string | null;
};

type Tab = "order" | "add";

type Props = {
    table: Table;
    staffId: string;
    venueId: string;
    onBack: () => void;
    onGoToTableOps: () => void;
    onGoToInvoice: () => void;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    confirmed: { label: "Confirmed", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
    preparing: { label: "Preparing", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    ready: { label: "Ready", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
    served: { label: "Served", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600 ring-red-200" },
};

function statusMeta(status: string) {
    return STATUS_META[status] ?? { label: status, cls: "bg-isabelline text-feldgrau ring-licorice/10" };
}

function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m ago`;
}

export function OrderManagementScreen({ table, staffId, venueId, onBack, onGoToTableOps, onGoToInvoice }: Props) {
    const [tab, setTab] = useState<Tab>("order");

    // ── Real bill + submissions for this table ──
    const [billId, setBillId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<DbOrderSubmission[]>([]);
    const [itemsBySubmission, setItemsBySubmission] = useState<Record<string, DbOrderItem[]>>({});
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [closingBill, setClosingBill] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    const closeTable = useCallback(async () => {
        if (!billId || closingBill) return;
        setClosingBill(true);
        const { ok, error } = await db.closeBill(billId, staffId);
        setClosingBill(false);
        setConfirmClose(false);
        if (!ok) {
            toast.error(error ? String((error as { message?: string }).message ?? error) : "Couldn't close this table");
            return;
        }
        toast.success("Table closed — bill cancelled");
        setBillId(null);
        setSubmissions([]);
        setItemsBySubmission({});
    }, [billId, staffId, closingBill]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data: bill } = await db.openBillForTable(table.id);
            if (bill) {
                const billId =
                    bill.waiter_id
                        ? bill.id
                        : ((await db.openBillForWaiter(table.id, staffId)).data?.id ?? bill.id);
                setBillId(billId);
                const { data: subs } = await db.submissionsByBill(bill.id);
                const list = subs ?? [];
                setSubmissions(list);
                const itemMap: Record<string, DbOrderItem[]> = {};
                await Promise.all(
                    list.map(async (s) => {
                        const { data: its } = await db.orderItemsBySubmission(s.id);
                        itemMap[s.id] = its ?? [];
                    }),
                );
                setItemsBySubmission(itemMap);
            } else {
                setBillId(null);
                setSubmissions([]);
                setItemsBySubmission({});
            }

            const [{ data: cats }, { data: prods }] = await Promise.all([
                db.menuCategories(venueId),
                db.products(venueId),
            ]);
            const catList = cats ?? [];
            setCategories(catList);
            setProducts(prods ?? []);
            if (catList.length > 0) {
                setActiveCategory((prev) => {
                    const stillExists = prev && catList.some((c) => c.id === prev);
                    return stillExists ? prev : catList[0].id;
                });
            }
        } catch {
            toast.error("Failed to load this table's orders");
        } finally {
            setLoading(false);
        }
    }, [table.id, venueId]);

    useEffect(() => {
        load();
    }, [load]);

    // Live refresh — customer submissions and items land here instantly.
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

    // ── Waiter-composed order (Add Items tab) ──
    const [order, setOrder] = useState<OrderLine[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>("");
    const [sending, setSending] = useState(false);

    // Real menu (products + categories from the DB)
    const [categories, setCategories] = useState<DbMenuCategory[]>([]);
    const [products, setProducts] = useState<DbProduct[]>([]);

    const catNameById = useMemo(() => {
        const m: Record<string, string> = {};
        for (const c of categories) m[c.id] = c.name;
        return m;
    }, [categories]);

    const menuItems = useMemo<WItem[]>(() => {
        return products
            .filter((p) => p.category_id && catNameById[p.category_id])
            .map((p) => ({
                id: p.id,
                name: p.name,
                categoryId: p.category_id as string,
                category: catNameById[p.category_id as string],
                price: p.price,
                image: p.images?.[0] ?? null,
            }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [products, catNameById]);

    const filteredMenu = useMemo(
        () => menuItems.filter((m) => m.categoryId === activeCategory),
        [menuItems, activeCategory]
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

    const addToOrder = (item: WItem) => {
        setOrder((prev) => {
            const existing = prev.find((line) => line.menuItem.id === item.id);
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

    const sendToKitchen = async () => {
        if (order.length === 0 || sending) return;
        setSending(true);
        try {
            // Ensure there is an open bill for the table first (server claims or
            // creates one, owned by this waiter — no more waiterless bills).
            const { data: bill } = await db.openBillForWaiter(table.id, staffId);
            if (!bill) {
                toast.error("Could not open a bill for this table");
                return;
            }
            setBillId(bill.id);

            const notes = order.map((l) => l.notes).filter(Boolean).join("; ") || undefined;
            const { data: submission } = await db.createOrderSubmission(
                bill.id,
                bill.venue_id,
                "kitchen",
                notes,
            );
            if (!submission) {
                toast.error("Could not create the order");
                return;
            }
            for (const line of order) {
                await db.createOrderItem(
                    submission.id,
                    bill.id,
                    line.menuItem.id,
                    line.menuItem.name,
                    line.quantity,
                    line.menuItem.price,
                    [],
                    0,
                    line.menuItem.price * line.quantity,
                    line.notes,
                );
            }
            setOrder([]);
            toast.success(`Sent ${order.length} ${order.length === 1 ? "item" : "items"} to kitchen`);
            await load();
        } catch {
            toast.error("Failed to send order to kitchen");
        } finally {
            setSending(false);
        }
    };

    const cancelSubmission = async (submissionId: string) => {
        if (cancellingId) return;
        setCancellingId(submissionId);
        try {
            const { data: ok, error } = await db.setOrderStatus(submissionId, "cancelled", staffId);
            if (error || !ok) {
                toast.error(error ? String((error as { message?: string }).message ?? error) : "Could not cancel");
                return;
            }
            toast.success("Order cancelled");
            await load();
        } catch {
            toast.error("Failed to cancel order");
        } finally {
            setCancellingId(null);
        }
    };

    const canCancel = (status: string) => status !== "served" && status !== "cancelled";

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
                        {billId && (
                            <button
                                type="button"
                                onClick={() => setConfirmClose((c) => !c)}
                                disabled={closingBill}
                                aria-label="Close table"
                                className={`rounded-full px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider shadow-sm transition-colors active:scale-95 ${confirmClose
                                    ? "bg-red-700 text-white"
                                    : "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                                    }`}
                            >
                                {closingBill ? "…" : confirmClose ? "Tap again" : "Close"}
                            </button>
                        )}
                        {confirmClose && billId && (
                            <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-6" onClick={() => setConfirmClose(false)}>
                                <div
                                    className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="text-[14px] font-bold text-licorice">Close this table?</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-feldgrau">
                                        The bill will be cancelled and this table's session will end. Guests can re-scan
                                        the QR to start fresh.
                                    </p>
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmClose(false)}
                                            className="flex-1 rounded-full py-2.5 text-[12px] font-bold text-feldgrau ring-1 ring-licorice/10"
                                        >
                                            Keep open
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeTable}
                                            className="flex-1 rounded-full py-2.5 text-[12px] font-bold text-white bg-red-700"
                                        >
                                            Close table
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
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
                            {submissions.length > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-khaki/30 px-1.5 py-0.5 text-[8px] font-bold tabular-nums">
                                    {submissions.length}
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
                            {itemCount > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-khaki/30 px-1.5 py-0.5 text-[8px] font-bold tabular-nums">
                                    {itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-7xl flex-1 px-5 md:px-8 pt-5 pb-[120px]">
                {/* ── CURRENT ORDER TAB (real submissions) ── */}
                {tab === "order" && (
                    <div className="animate-velvet-fade">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                                <span className="h-1.5 w-1.5 rounded-full bg-khaki" />
                                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                                    Nothing ordered yet
                                </h3>
                                <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                    {billId
                                        ? "Orders from the table will appear here live."
                                        : "Switch to Add Items to take this table's order."}
                                </p>
                                {!billId && (
                                    <button
                                        type="button"
                                        onClick={() => setTab("add")}
                                        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] active:scale-95"
                                    >
                                        <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                        Add Items
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {submissions.map((sub, idx) => {
                                    const items = itemsBySubmission[sub.id] ?? [];
                                    const meta = statusMeta(sub.status);
                                    return (
                                        <div
                                            key={sub.id}
                                            className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_14px_rgba(35,20,12,0.05)] ring-1 ring-isabelline"
                                            style={{ animationDelay: `${Math.min(idx * 30, 180)}ms` }}
                                        >
                                            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                                                        {sub.station === "bar" ? "Bar ticket" : "Kitchen ticket"}
                                                    </span>
                                                    {sub.guest_name && (
                                                        <span className="text-[10px] font-semibold text-feldgrau/60">
                                                            · {sub.guest_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${meta.cls}`}>
                                                        {meta.label}
                                                    </span>
                                                    <span className="text-[9.5px] text-feldgrau/50">{timeAgo(sub.created_at)}</span>
                                                </div>
                                            </div>

                                            <div className="px-3.5 pb-2.5">
                                                {items.map((it) => (
                                                    <div key={it.id} className="flex items-center justify-between py-1 text-[12px]">
                                                        <span className="text-licorice">
                                                            <span className="font-mono font-bold text-feldgrau">×{it.quantity}</span>{" "}
                                                            {it.product_name}
                                                            {it.notes && (
                                                                <span className="text-feldgrau/60"> — {it.notes}</span>
                                                            )}
                                                        </span>
                                                        <span className="font-mono font-bold tabular-nums text-licorice">
                                                            {formatGHS(it.line_total)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {canCancel(sub.status) && (
                                                <div className="flex items-center justify-between border-t border-isabelline px-3.5 py-2">
                                                    <span className="text-[10px] text-feldgrau/60">
                                                        Customers can't cancel — staff only.
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => cancelSubmission(sub.id)}
                                                        disabled={cancellingId !== null}
                                                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600 ring-1 ring-red-200 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
                                                    >
                                                        <XMarkIcon className="h-3 w-3" strokeWidth={2.5} />
                                                        {cancellingId === sub.id ? "Cancelling…" : "Cancel Order"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => setTab("add")}
                                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-4 text-[12px] font-bold tracking-tight text-licorice shadow-sm ring-1 ring-licorice/10 transition-all hover:bg-isabelline active:scale-[0.98]"
                                >
                                    <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                                    Add more items to table
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ADD ITEMS TAB ── */}
                {tab === "add" && (
                    <div className="animate-velvet-fade">
                        {/* Category pills */}
                        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
                            {categories.length === 0 ? (
                                <span className="text-[12px] text-feldgrau">
                                    No menu categories — add some in the Manager portal.
                                </span>
                            ) : (
                                categories.map((cat) => {
                                    const isActive = cat.id === activeCategory;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setActiveCategory(cat.id)}
                                            className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${isActive
                                                ? "bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]"
                                                : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                                }`}
                                        >
                                            {cat.name}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Items grid */}
                        {filteredMenu.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-isabelline">
                                <h3 className="text-[14px] font-bold tracking-tight text-licorice">
                                    No items in this category yet
                                </h3>
                                <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                    Add products in the Manager portal under Menu.
                                </p>
                            </div>
                        ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                            {filteredMenu.map((item, idx) => (
                                <MenuItemCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    price={item.price}
                                    image={item.image}
                                    category={item.category}
                                    onClick={() => addToOrder(item)}
                                    onAdd={() => addToOrder(item)}
                                    animationDelayMs={Math.min(idx * 30, 200)}
                                />
                            ))}
                        </div>
                        )}
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR (Add Items only)
              ═══════════════════════════════════════════════════════════ */}
            {tab === "add" && order.length > 0 && (
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
                            disabled={order.length === 0 || sending}
                            className={`
                                ml-auto inline-flex items-center justify-center gap-1.5
                                rounded-full px-5 py-3
                                text-[12px] font-bold tracking-tight
                                transition-all duration-200 active:scale-[0.98]
                                bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95 disabled:opacity-40 disabled:shadow-none
                            `}
                        >
                            {sending ? (
                                <>
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-isabelline/30 border-t-isabelline" />
                                    Sending…
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                    Send to Kitchen
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
