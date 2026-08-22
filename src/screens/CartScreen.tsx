import { useMemo, useState, useEffect } from "react";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ClockIcon,
    MapPinIcon,
    MinusIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { formatGHS } from "../data/menu";
import { getLineUnitPrice, useCart } from "../context/CartContext";
import type { OrderSummary } from "./OrderTrackingScreen";
import { db, type DbOrderItem } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";

type Props = {
    venueId: string;
    venueName?: string;
    tableLabel?: string;
    tableId?: string;
    billId?: string | null;
    customerSessionId?: string | null;
    sessionToken?: string | null;
    onBack?: () => void;
    onContinueShopping?: () => void;
    onOrderSent?: (order: OrderSummary) => void;
};

/** Estimated prep time based on item count — gives the page a "living" feel. */
function estimatePrepMinutes(itemCount: number): string {
    if (itemCount === 0) return "—";
    const base = 8;
    const perItem = 2;
    const min = base + Math.floor(itemCount * perItem);
    return `${min}–${min + 4} min`;
}

export function CartScreen({ venueId, tableLabel, billId, customerSessionId, sessionToken, onBack, onContinueShopping, onOrderSent }: Props) {
    const { lines, itemCount, subtotal, setQty, remove, clear } = useCart();
    const [orderNotes, setOrderNotes] = useState("");
    const [sending, setSending] = useState(false);

    // Placed orders on the table's open bill
    const [placedItems, setPlacedItems] = useState<DbOrderItem[]>([]);
    const [placedBill, setPlacedBill] = useState<{ subtotal: number; vat: number; total: number } | null>(null);
    const [loadingPlaced, setLoadingPlaced] = useState(true);

    useEffect(() => {
        let active = true;
        if (!billId) {
            setLoadingPlaced(false);
            return;
        }

        const fetchPlaced = async () => {
            const [itemsRes, billRes] = await Promise.all([
                db.orderItemsByBill(billId, sessionToken),
                db.customerBill(billId, sessionToken),
            ]);
            if (!active) return;
            const valid = (itemsRes.data ?? []).filter((i) => i.status !== 'cancelled');
            setPlacedItems(valid);
            if (billRes.data) {
                setPlacedBill({
                    subtotal: Number(billRes.data.subtotal ?? 0),
                    vat: Number(billRes.data.vat ?? 0),
                    total: Number(billRes.data.total ?? 0),
                });
            }
            setLoadingPlaced(false);
        };

        fetchPlaced();
        return () => {
            active = false;
        };
    }, [billId, sessionToken]);

    useRealtime({
        table: 'order_items',
        filter: billId ? `bill_id=eq.${billId}` : undefined,
        onInsert: () => {
            if (billId) {
                db.orderItemsByBill(billId, sessionToken).then(({ data }) => {
                    setPlacedItems((data ?? []).filter((i) => i.status !== 'cancelled'));
                });
                db.customerBill(billId, sessionToken).then(({ data }) => {
                    if (data) setPlacedBill({ subtotal: Number(data.subtotal ?? 0), vat: Number(data.vat ?? 0), total: Number(data.total ?? 0) });
                });
            }
        },
        onUpdate: () => {
            if (billId) {
                db.orderItemsByBill(billId, sessionToken).then(({ data }) => {
                    setPlacedItems((data ?? []).filter((i) => i.status !== 'cancelled'));
                });
                db.customerBill(billId, sessionToken).then(({ data }) => {
                    if (data) setPlacedBill({ subtotal: Number(data.subtotal ?? 0), vat: Number(data.vat ?? 0), total: Number(data.total ?? 0) });
                });
            }
        },
    });

    // Venue-driven bill math (falls back to 10% / 12.5% only until the venue loads)
    const [venueFees, setVenueFees] = useState<{ serviceChargePct: number; vatPct: number }>({
        serviceChargePct: 10,
        vatPct: 12.5,
    });

    useEffect(() => {
        let active = true;
        db.venueById(venueId).then(({ data, error }) => {
            if (!active || error || !data) return;
            setVenueFees({
                serviceChargePct: data.service_charge_pct ?? 10,
                vatPct: data.vat_pct ?? 12.5,
            });
        });
        return () => {
            active = false;
        };
    }, [venueId]);

    // Combined item count and bill math
    const draftCount = itemCount;
    const placedCount = placedItems.reduce((acc, i) => acc + i.quantity, 0);
    const displayItemCount = draftCount + placedCount;

    const draftSubtotal = subtotal;
    const placedSubtotal = placedItems.reduce((acc, i) => acc + Number(i.line_total || 0), 0);
    const combinedSubtotal = draftSubtotal + placedSubtotal;

    const { serviceCharge, vat, total } = useMemo(() => {
        const service = Math.round(combinedSubtotal * (venueFees.serviceChargePct / 100) * 100) / 100;
        const tax = Math.round(combinedSubtotal * (venueFees.vatPct / 100) * 100) / 100;
        return {
            serviceCharge: service,
            vat: tax,
            total: combinedSubtotal + service + tax,
        };
    }, [combinedSubtotal, venueFees]);

    const handleSendToKitchen = async () => {
        if (!billId || !customerSessionId) {
            toast.error("Something went wrong — please rescan the table QR code.");
            return;
        }
        if (lines.length === 0) {
            toast.error("Your cart is empty.");
            return;
        }

        setSending(true);

        try {
            for (const line of lines) {
                const station: 'kitchen' | 'bar' = line.item.station === 'bar' ? 'bar' : 'kitchen';
                const { data: submission, error: subErr } = await db.createOrderSubmission(
                    billId,
                    venueId,
                    station,
                    line.notes || orderNotes || undefined,
                    customerSessionId,
                    undefined,
                    sessionToken,
                );

                if (subErr || !submission) {
                    throw subErr || new Error("Failed to submit order");
                }

                const unitPrice = getLineUnitPrice(line);
                const { error: itemErr } = await db.createOrderItem(
                    submission.id,
                    submission.bill_id,
                    line.item.id,
                    line.item.name,
                    line.qty,
                    unitPrice,
                    line.modifiers.map((m) => ({ group_id: m.groupId, option_id: m.option.id, option_name: m.option.name, price_delta: m.option.priceDelta ?? 0 })),
                    line.modifiers.reduce((s, m) => s + (m.option.priceDelta ?? 0) * line.qty, 0),
                    unitPrice * line.qty,
                    line.notes,
                    customerSessionId,
                    sessionToken,
                );
                if (itemErr) throw itemErr;

                const orderNumber = submission.id.slice(0, 8).toUpperCase();
                const lineTotal = unitPrice * line.qty;

                const order: OrderSummary = {
                    orderNumber,
                    items: [
                        {
                            name: line.item.name,
                            qty: line.qty,
                            image: line.item.image,
                            lineTotal,
                        },
                    ],
                    total: lineTotal,
                    itemCount: line.qty,
                    sentAt: Date.now(),
                    venueId,
                    billId,
                    submissionId: submission.id,
                    status: "confirmed",
                };

                onOrderSent?.(order);
            }

            clear();
            toast.success(`Sent ${lines.length} ${lines.length === 1 ? "item" : "items"} to kitchen`);
        } catch (err) {
            console.error("Failed to send order:", err);
            toast.error("Couldn't send your order. Please try again.");
            setSending(false);
        }
    };

    const hasDraft = lines.length > 0;
    const hasPlaced = placedItems.length > 0;

    // ── Empty state ── (only show if NO draft items AND NO placed session items exist)
    if (!hasDraft && !hasPlaced && !loadingPlaced) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
                {/* Dark hero */}
                <div className="relative overflow-hidden bg-gradient-to-b from-licorice via-licorice to-licorice/95 pt-[max(env(safe-area-inset-top),20px)] pb-20">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                    >
                        <div className="absolute -top-16 -right-12 h-56 w-56 rounded-full bg-khaki mix-blend-screen blur-[70px] opacity-20" />
                        <div className="absolute top-20 -left-16 h-48 w-48 rounded-full bg-light-blue mix-blend-screen blur-[70px] opacity-15" />
                    </div>

                    <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-isabelline/15 bg-isabelline/5 text-isabelline transition-colors hover:bg-isabelline/10 active:scale-95"
                        >
                            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        
                        <h1 className="text-[16px] font-bold tracking-tight text-isabelline absolute left-1/2 -translate-x-1/2">
                            Your Tab
                        </h1>
                    </div>

                    <div className="relative z-10 mt-8 mx-auto w-full max-w-7xl px-5 md:px-8 text-center">
                        <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-[-0.04em] text-isabelline">
                            Nothing here
                            <br />
                            <span className="italic font-serif font-bold text-khaki">
                                just yet
                            </span>
                        </h1>
                        <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-[1.55] tracking-tight text-isabelline/65">
                            Head back to the menu and add a few things to get
                            started.
                        </p>
                    </div>
                </div>

                {/* Overlapping CTA */}
                <div className="fixed inset-x-0 bottom-[88px] z-40 flex justify-center px-5 md:px-8">
                    <button
                        type="button"
                        onClick={onContinueShopping}
                        className="
                            group flex w-full max-w-md md:max-w-2xl mx-auto items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            transition-all duration-200 ease-out
                            hover:bg-licorice/95
                            active:scale-[0.985]
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Browse
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                Open the Menu
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-transform duration-200 group-hover:translate-x-0.5">
                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                    </button>
                </div>
            </main>
        );
    }

    // ── Main cart view ──
    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                DARK LICORICE HERO
              ═══════════════════════════════════════════════════════════ */}
            <header className="relative overflow-hidden bg-gradient-to-b from-licorice via-licorice to-licorice/95 pt-[max(env(safe-area-inset-top),20px)] pb-20">
                {/* Blur orbs */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -top-16 -right-12 h-56 w-56 rounded-full bg-khaki mix-blend-screen blur-[70px] opacity-20" />
                    <div className="absolute top-20 -left-16 h-48 w-48 rounded-full bg-light-blue mix-blend-screen blur-[70px] opacity-15" />
                </div>

                {/* Top bar */}
                <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-isabelline/15 bg-isabelline/5 text-isabelline transition-colors hover:bg-isabelline/10 active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    
                    <h1 className="text-[16px] font-bold tracking-tight text-isabelline absolute left-1/2 -translate-x-1/2">
                        Your Tab
                    </h1>
                </div>

                {/* Hero summary */}
                <div className="relative z-10 mt-7 mx-auto w-full max-w-7xl px-5 md:px-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-khaki">
                        {displayItemCount} {displayItemCount === 1 ? "item" : "items"} {hasDraft ? "ready" : "on tab"}
                    </p>
                    <h1 className="mt-2 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-isabelline">
                        {hasDraft ? (
                            <>
                                Review &
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    send
                                </span>{" "}
                                to the kitchen.
                            </>
                        ) : (
                            <>
                                Running
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    Table Bill
                                </span>
                            </>
                        )}
                    </h1>
                </div>

                {/* Widget strip — quiet, just two pills */}
                <div className="relative z-10 mt-5 mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-5 md:px-8">
                    <div className="inline-flex items-center gap-1.5 rounded-2xl border border-khaki/30 bg-khaki/10 px-3 py-2 backdrop-blur-md">
                        <ClockIcon className="h-3.5 w-3.5 text-khaki" strokeWidth={2.25} />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-khaki">
                                Est. Prep
                            </span>
                            <span className="text-[11px] font-bold text-isabelline">
                                {estimatePrepMinutes(displayItemCount)}
                            </span>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-2xl border border-isabelline/15 bg-isabelline/5 px-3 py-2 backdrop-blur-md">
                        <MapPinIcon className="h-3.5 w-3.5 text-isabelline/70" strokeWidth={2.25} />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-isabelline/60">
                                Table
                            </span>
                            <span className="text-[11px] font-bold text-isabelline">
                                {tableLabel ?? "—"}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                OVERLAPPING CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="relative z-20 mx-auto w-full max-w-7xl -mt-12 px-5 md:px-8 pb-[calc(140px+env(safe-area-inset-bottom))]">
                {/* ── Cart draft line items ── */}
                {hasDraft && (
                    <div className="flex flex-col gap-3">
                        {lines.map((line, idx) => {
                            const unitPrice = getLineUnitPrice(line);
                            const lineTotal = unitPrice * line.qty;
                            return (
                                <div
                                    key={line.lineId}
                                    className="
                                        animate-velvet-rise
                                        relative overflow-hidden rounded-2xl bg-white p-3
                                        shadow-[0_4px_16px_rgba(35,20,12,0.06)]
                                        ring-1 ring-isabelline
                                    "
                                    style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
                                >
                                    <div className="flex gap-3">
                                        {/* Square image */}
                                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-isabelline">
                                            <img
                                                src={line.item.image}
                                                alt={line.item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>

                                        {/* Body */}
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-[14px] font-bold leading-tight tracking-tight text-licorice">
                                                        {line.item.name}
                                                    </h3>
                                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-feldgrau">
                                                        {line.item.category}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(line.lineId)}
                                                    aria-label={`Remove ${line.item.name} from cart`}
                                                    className="
                                                        flex h-7 w-7 shrink-0 items-center justify-center
                                                        rounded-full text-feldgrau transition-all
                                                        hover:bg-dark-red/10 hover:text-dark-red active:scale-90
                                                    "
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                                </button>
                                            </div>

                                            {/* Modifier chips */}
                                            {line.modifiers.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {line.modifiers.map((m) => (
                                                        <span
                                                            key={`${m.groupId}-${m.option.id}`}
                                                            className="
                                                                inline-flex items-center gap-0.5 rounded-full
                                                                bg-isabelline px-1.5 py-0.5
                                                                text-[9px] font-semibold tracking-tight text-feldgrau
                                                            "
                                                        >
                                                            {m.option.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {line.notes && (
                                                <p className="mt-1.5 line-clamp-1 text-[10.5px] italic tracking-tight text-feldgrau/80">
                                                    "{line.notes}"
                                                </p>
                                            )}

                                            {/* Bottom row: qty stepper + line total */}
                                            <div className="mt-auto flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-1 rounded-full bg-isabelline p-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQty(line.lineId, line.qty - 1)}
                                                        aria-label="Decrease quantity"
                                                        className="
                                                            flex h-7 w-7 items-center justify-center rounded-full
                                                            text-licorice transition-colors
                                                            hover:bg-white active:scale-90
                                                        "
                                                    >
                                                        <MinusIcon className="h-3 w-3" strokeWidth={2.5} />
                                                    </button>
                                                    <span className="w-5 text-center font-mono text-[12px] font-bold tabular-nums text-licorice">
                                                        {line.qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQty(line.lineId, line.qty + 1)}
                                                        aria-label="Increase quantity"
                                                        className="
                                                            flex h-7 w-7 items-center justify-center rounded-full
                                                            bg-licorice text-isabelline transition-colors
                                                            hover:bg-licorice/90 active:scale-90
                                                        "
                                                    >
                                                        <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                                                    </button>
                                                </div>

                                                <span className="font-mono text-[14px] font-bold tabular-nums text-khaki">
                                                    {formatGHS(lineTotal)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Placed session items ── */}
                {hasPlaced && (
                    <div className={`flex flex-col gap-3 ${hasDraft ? "mt-6" : ""}`}>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                                Placed Session Items ({placedItems.length})
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-khaki">
                                Sent to Kitchen
                            </span>
                        </div>
                        {placedItems.map((item) => (
                            <div
                                key={item.id}
                                className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[13px] font-bold text-licorice">
                                                {item.quantity}x
                                            </span>
                                            <h3 className="truncate text-[14px] font-bold leading-tight tracking-tight text-licorice">
                                                {item.product_name}
                                            </h3>
                                        </div>
                                        {item.notes && (
                                            <p className="mt-1 text-[10.5px] italic text-feldgrau/80">
                                                "{item.notes}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-mono text-[14px] font-bold tabular-nums text-khaki">
                                            {formatGHS(Number(item.line_total || 0))}
                                        </span>
                                        <div className="mt-1">
                                            <span className="inline-flex rounded-full bg-licorice/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                                {item.status || "sent"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Add more items link ── */}
                <button
                    type="button"
                    onClick={onContinueShopping}
                    className="
                        mt-3 flex w-full items-center justify-center gap-1.5
                        rounded-2xl bg-white/70 px-4 py-3
                        text-[12px] font-bold tracking-tight text-licorice
                        ring-1 ring-isabelline backdrop-blur-md
                        transition-all hover:bg-white hover:ring-khaki/30 active:scale-[0.99]
                    "
                >
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add more items
                </button>

                {/* ── Order notes (for new draft items) ── */}
                {hasDraft && (
                    <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-khaki/15">
                                    <PencilSquareIcon className="h-3.5 w-3.5 text-licorice/70" strokeWidth={2} />
                                </div>
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Notes for the kitchen
                                </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                Optional
                            </span>
                        </div>
                        <textarea
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value.slice(0, 200))}
                            placeholder="Allergies, timing, or anything we should know…"
                            rows={2}
                            className="
                                mt-3 w-full resize-none rounded-xl
                                bg-isabelline/60 px-3 py-2.5
                                text-[12.5px] text-licorice
                                placeholder:text-feldgrau/60
                                ring-1 ring-isabelline
                                focus:outline-none focus:ring-2 focus:ring-licorice/20
                                transition-all
                            "
                        />
                        <div className="mt-1 text-right text-[9px] font-medium tracking-tight text-feldgrau/70">
                            {orderNotes.length}/200
                        </div>
                    </div>
                )}

                {/* ── Bill summary ── */}
                <div className="mt-4 overflow-hidden rounded-2xl bg-licorice text-isabelline shadow-[0_12px_32px_rgba(35,20,12,0.18)]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-isabelline/10 px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            Bill Summary
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-isabelline/50">
                            Table {tableLabel ?? "—"}
                        </span>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2 px-4 py-3">
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="tracking-tight text-isabelline/70">Subtotal</span>
                            <span className="font-mono font-bold tabular-nums text-isabelline">
                                {formatGHS(combinedSubtotal)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="tracking-tight text-isabelline/70">
                                VAT <span className="text-isabelline/40">({venueFees.vatPct}%)</span>
                            </span>
                            <span className="font-mono font-bold tabular-nums text-isabelline">
                                {formatGHS(vat)}
                            </span>
                        </div>
                    </div>

                    {/* Grand total */}
                    <div className="flex items-end justify-between border-t border-isabelline/10 px-4 py-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Grand Total
                            </p>
                            <p className="text-[10px] font-medium tracking-tight text-isabelline/50">
                                Pay after your meal
                            </p>
                        </div>
                        <span className="font-mono text-[22px] font-black tabular-nums text-isabelline">
                            {formatGHS(total)}
                        </span>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                STICKY BOTTOM CTA — Send to Kitchen (only when draft items exist)
              ═══════════════════════════════════════════════════════════ */}
            {hasDraft && (
                <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                    <button
                        type="button"
                        onClick={handleSendToKitchen}
                        disabled={sending}
                        className="
                            group flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            transition-all duration-200 ease-out
                            hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)]
                            active:scale-[0.985]
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                            disabled:opacity-90
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                {sending ? "Sending…" : "Ready"}
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                {sending ? "Sending to kitchen" : "Send to Kitchen"}
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-transform duration-200 group-hover:translate-x-0.5">
                            {sending ? (
                                <svg
                                    className="h-4 w-4 animate-spin"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeOpacity="0.25"
                                    />
                                    <path
                                        d="M22 12a10 10 0 0 1-10 10"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            ) : (
                                <PaperAirplaneIcon className="h-4 w-4" strokeWidth={2} />
                            )}
                        </span>
                    </button>
                </div>
            )}
        </main>
    );
}
