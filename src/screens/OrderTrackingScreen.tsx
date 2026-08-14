import { useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";

/* ────────────────────────── Order data types ────────────────────────── */

export type OrderItem = {
    name: string;
    qty: number;
    image: string;
    lineTotal: number;
};

/** Real order_submissions.status — mirrors the kitchen's queue. */
export type OrderStatusDb = "confirmed" | "preparing" | "ready" | "served" | "cancelled";

export type OrderSummary = {
    orderNumber: string;
    items: OrderItem[];
    total: number;
    itemCount: number;
    sentAt: number; // unix ms
    billId?: string;
    venueId?: string;
    /** Real submission row this order maps to (for live status). */
    submissionId?: string;
    status?: OrderStatusDb;
    /** Set when the venue (waiter) cancelled the submission. */
    cancelled?: boolean;
};

/* ────────────────────────── Tracking stages (real status) ────────────────────────── */

export type StageId = "received" | "preparing" | "on_the_way" | "served";

type Stage = {
    id: StageId;
    label: string;
    description: string;
    /** Real order_submissions.status that activates this stage. */
    status: OrderStatusDb;
};

// eslint-disable-next-line react-refresh/only-export-components
export const STAGES: Stage[] = [
    {
        id: "received",
        label: "Order Received",
        description: "Sent to the kitchen — they have the ticket",
        status: "confirmed",
    },
    {
        id: "preparing",
        label: "In Preparation",
        description: "The team is crafting your order",
        status: "preparing",
    },
    {
        id: "on_the_way",
        label: "Ready — On Its Way",
        description: "Your order is ready and being brought to you",
        status: "ready",
    },
    {
        id: "served",
        label: "Served",
        description: "Enjoy — your order has arrived",
        status: "served",
    },
];

// eslint-disable-next-line react-refresh/only-export-components
export function statusStage(status?: OrderStatusDb): Stage {
    const stage = STAGES.find((s) => s.status === status);
    return stage ?? STAGES[0];
}

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    order: OrderSummary;
    onBackToMenu: () => void;
    onPayBill: () => void;
};

export function OrderTrackingScreen({ order, onBackToMenu, onPayBill }: Props) {
    const [summaryOpen, setSummaryOpen] = useState(false);

    // Live status comes from the real order_submissions row — no fake timers.
    const currentStage = useMemo(() => statusStage(order.status), [order.status]);
    const currentIndex = STAGES.indexOf(currentStage);
    const isServed = currentStage.id === "served";

    const statusHeadline = currentStage.label;
    const statusSub = currentStage.description;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER — sticky, minimal
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3 relative">
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={onBackToMenu}
                            aria-label="Back to menu"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                        >
                            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                    </div>

                    <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] bottom-3 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center leading-tight pointer-events-auto">
                            <span className="text-[18px] font-bold tracking-tight text-licorice">
                                Order Tracking
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <button
                            type="button"
                            className="
                                rounded-full border border-licorice/20 bg-transparent
                                px-3 py-1.5
                                text-[11px] font-bold uppercase tracking-wider text-licorice
                                transition-all
                                hover:border-licorice/40 hover:bg-licorice/5
                                active:scale-95
                            "
                        >
                            Table 4
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
                {/* ── Status Hero ── */}
                <div className="mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                        {isServed ? "Complete" : "Live"}
                    </p>
                    <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                        {statusHeadline}
                        {!isServed && (
                            <>
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    live
                                </span>
                            </>
                        )}
                    </h1>
                    <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                        {statusSub}
                    </p>
                </div>

                {/* ── Vertical Timeline ── */}
                <div className="mb-8">
                    <div className="relative">
                        {/* Vertical connecting line */}
                        <div
                            aria-hidden="true"
                            className="absolute left-[11px] top-3 bottom-3 w-px bg-licorice/10"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute left-[11px] top-3 w-px bg-licorice transition-all duration-700 ease-out"
                            style={{
                                height: `${(currentIndex / (STAGES.length - 1)) * 100}%`,
                            }}
                        />

                        {STAGES.map((stage, idx) => {
                            const isCurrent = idx === currentIndex;
                            const isPast = idx < currentIndex;

                            return (
                                <div
                                    key={stage.id}
                                    className="relative flex items-start gap-4 pb-6 last:pb-0 animate-velvet-rise"
                                    style={{ animationDelay: `${idx * 80}ms` }}
                                >
                                    {/* Dot */}
                                    <div className="relative z-10 flex shrink-0 items-center justify-center pt-0.5">
                                        <div
                                            className={`
                                                flex h-6 w-6 items-center justify-center rounded-full
                                                transition-all duration-500 ease-out
                                                ${isPast
                                                    ? "bg-licorice text-isabelline"
                                                    : isCurrent
                                                        ? "bg-licorice text-isabelline ring-4 ring-khaki/30"
                                                        : "bg-white text-feldgrau ring-1 ring-licorice/15"
                                                }
                                            `}
                                        >
                                            {isPast ? (
                                                <CheckIcon className="h-3 w-3" strokeWidth={3} />
                                            ) : isCurrent && !isServed ? (
                                                <span className="h-2 w-2 rounded-full bg-khaki animate-pulse" />
                                            ) : isCurrent && isServed ? (
                                                <CheckCircleIcon className="h-3.5 w-3.5 text-khaki" />
                                            ) : (
                                                <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h3
                                                className={`text-[14px] font-bold leading-tight tracking-tight transition-colors ${isPast || isCurrent ? "text-licorice" : "text-feldgrau/60"}`}
                                            >
                                                {stage.label}
                                            </h3>
                                            <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider tabular-nums text-feldgrau">
                                                {isPast ? "done" : isCurrent ? "now" : ""}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11.5px] leading-[1.4] tracking-tight text-feldgrau">
                                            {stage.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Order Summary (collapsible) ── */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    <button
                        type="button"
                        onClick={() => setSummaryOpen((v) => !v)}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-isabelline/40"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Your Order
                            </span>
                            <span className="text-[10px] font-semibold tabular-nums text-feldgrau">
                                {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-bold tabular-nums text-licorice">
                                {formatGHS(order.total)}
                            </span>
                            <ChevronDownIcon
                                className={`h-4 w-4 text-feldgrau transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`}
                                strokeWidth={2.25}
                            />
                        </div>
                    </button>

                    {summaryOpen && (
                        <div className="border-t border-isabelline px-4 py-3 animate-velvet-fade">
                            <div className="flex flex-col gap-2.5">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-isabelline">
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">
                                                {item.name}
                                            </p>
                                            <p className="text-[10px] font-semibold tabular-nums text-feldgrau">
                                                ×{item.qty}
                                            </p>
                                        </div>
                                        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-licorice">
                                            {formatGHS(item.lineTotal)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                STICKY BOTTOM CTA — appears when served
              ═══════════════════════════════════════════════════════════ */}
            {isServed && (
                <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                    <button
                        type="button"
                        onClick={onPayBill}
                        className="
                            group animate-velvet-rise flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_8px_30px_rgba(35,20,12,0.16)]
                            ring-1 ring-licorice/80
                            transition-all duration-200 ease-out
                            hover:bg-licorice/95 hover:shadow-[0_12px_40px_rgba(35,20,12,0.22)]
                            active:scale-[0.985]
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                        "
                    >
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Settle up
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                Pay {formatGHS(order.total)}
                            </span>
                        </div>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-transform duration-200 group-hover:translate-x-0.5">
                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={onBackToMenu}
                        className="
                            flex w-full max-w-md md:max-w-2xl items-center justify-center
                            rounded-2xl bg-white px-6 py-4
                            text-[15px] font-bold tracking-tight text-licorice
                            shadow-[0_8px_24px_rgba(35,20,12,0.04)] ring-1 ring-licorice/8
                            transition-all duration-200 ease-out
                            hover:bg-isabelline active:scale-[0.985]
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                        "
                    >
                        Or order something else
                    </button>
                </div>
            )}
        </main>
    );
}
