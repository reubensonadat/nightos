import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    BellIcon,
    CheckIcon,
    ChevronDownIcon,
    PhoneIcon,
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

export type OrderSummary = {
    orderNumber: string;
    items: OrderItem[];
    total: number;
    itemCount: number;
    sentAt: number; // unix ms
    billId?: string;
    venueId?: string;
};

/* ────────────────────────── Tracking stages ────────────────────────── */

type StageId = "received" | "preparing" | "on_the_way" | "served";

type Stage = {
    id: StageId;
    label: string;
    description: string;
    /** Delay (ms) after order sent before this stage activates. */
    activatesAtMs: number;
};

const STAGES: Stage[] = [
    {
        id: "received",
        label: "Order Received",
        description: "Sent to the kitchen",
        activatesAtMs: 0,
    },
    {
        id: "preparing",
        label: "In Preparation",
        description: "The team is crafting your order",
        activatesAtMs: 3_000,
    },
    {
        id: "on_the_way",
        label: "On Its Way",
        description: "Kojo is bringing it to Table 04",
        activatesAtMs: 8_000,
    },
    {
        id: "served",
        label: "Served",
        description: "Enjoy — your order has arrived",
        activatesAtMs: 15_000,
    },
];

/* ────────────────────────── Helpers ────────────────────────── */

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-GH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function formatEta(msFromNow: number): string {
    if (msFromNow <= 0) return "Now";
    const mins = Math.ceil(msFromNow / 60_000);
    if (mins <= 1) return "< 1 min";
    return `${mins} min`;
}

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    order: OrderSummary;
    onBackToMenu: () => void;
    onPayBill: () => void;
};

export function OrderTrackingScreen({ order, onBackToMenu, onPayBill }: Props) {
    const [now, setNow] = useState(Date.now());
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [requested, setRequested] = useState(false);

    // Live ticker — updates every second for smooth ETA countdown
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(t);
    }, []);

    const elapsed = now - order.sentAt;

    // Determine current stage
    const currentStage = useMemo<Stage>(() => {
        const active = [...STAGES]
            .reverse()
            .find((s) => elapsed >= s.activatesAtMs);
        return active ?? STAGES[0];
    }, [elapsed]);

    const isServed = currentStage.id === "served";

    // ETA to served
    const servedStage = STAGES[STAGES.length - 1];
    const msUntilServed = servedStage.activatesAtMs - elapsed;
    const etaLabel = formatEta(msUntilServed);

    // Status headline
    const statusHeadline = isServed
        ? "Served"
        : currentStage.id === "on_the_way"
            ? "On its way"
            : currentStage.label;

    const statusSub = isServed
        ? "Your order is at the table."
        : currentStage.id === "on_the_way"
            ? "Kojo is walking over."
            : currentStage.id === "preparing"
                ? `Ready in ${etaLabel}.`
                : "The kitchen has your ticket.";

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER — sticky, minimal
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBackToMenu}
                        aria-label="Back to menu"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            Order Tracking
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            № {order.orderNumber}
                        </span>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-feldgrau shadow-sm ring-1 ring-licorice/8">
                        <span className="relative flex h-2 w-2">
                            {!isServed && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-khaki opacity-70" />
                            )}
                            <span
                                className={`relative inline-flex h-2 w-2 rounded-full ${isServed ? "bg-feldgrau" : "bg-khaki"}`}
                            />
                        </span>
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
                                    {etaLabel}
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
                                height: `${(STAGES.indexOf(currentStage) / (STAGES.length - 1)) * 100}%`,
                            }}
                        />

                        {STAGES.map((stage, idx) => {
                            const stageElapsed = elapsed >= stage.activatesAtMs;
                            const isCurrent = currentStage.id === stage.id;
                            const isPast = STAGES.indexOf(currentStage) > idx;
                            const stageTime = new Date(
                                order.sentAt + stage.activatesAtMs
                            ).getTime();

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
                                                className={`text-[14px] font-bold leading-tight tracking-tight transition-colors ${stageElapsed ? "text-licorice" : "text-feldgrau/60"}`}
                                            >
                                                {stage.label}
                                            </h3>
                                            <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-feldgrau">
                                                {stageElapsed
                                                    ? formatTime(stageTime)
                                                    : `~ ${formatEta(stage.activatesAtMs - elapsed)}`}
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

                {/* ── Server Card with Request + Call ── */}
                {!isServed && (
                    <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                        <div className="flex items-center gap-3 px-4 py-3.5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-khaki font-serif text-[16px] font-bold text-licorice">
                                K
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold tracking-tight text-licorice">
                                    Kojo · Server
                                </p>
                                <p className="text-[11px] tracking-tight text-feldgrau">
                                    Looking after Table 04 tonight
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRequested(true)}
                                disabled={requested}
                                aria-label={requested ? "Kojo has been notified" : "Request Kojo"}
                                className={`
                                    flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                    transition-all active:scale-95
                                    ${requested
                                        ? "bg-khaki/20 text-khaki"
                                        : "bg-isabelline text-licorice ring-1 ring-licorice/8 hover:bg-khaki/15"
                                    }
                                `}
                            >
                                {requested ? (
                                    <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                ) : (
                                    <BellIcon className="h-4 w-4" strokeWidth={2.25} />
                                )}
                            </button>
                            <button
                                type="button"
                                aria-label="Call Kojo"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] transition-all hover:bg-licorice/95 active:scale-95"
                            >
                                <PhoneIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>
                        {requested && (
                            <div className="border-t border-isabelline px-4 py-2.5 animate-velvet-fade">
                                <p className="text-[11px] font-semibold tracking-tight text-khaki">
                                    ✓ Kojo has been notified — on the way to Table 04
                                </p>
                            </div>
                        )}
                    </div>
                )}

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
                <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                    <button
                        type="button"
                        onClick={onPayBill}
                        className="animate-velvet-rise flex w-full max-w-md md:max-w-2xl items-center justify-between gap-3 rounded-full bg-licorice px-5 py-3.5 shadow-[0_20px_50px_rgba(35,20,12,0.25)] ring-1 ring-licorice/80 transition-all duration-200 ease-out hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)] active:scale-[0.985]"
                    >
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-khaki">
                                Settle up
                            </span>
                            <span className="text-[13px] font-bold tracking-tight text-isabelline">
                                Pay {formatGHS(order.total)}
                            </span>
                        </div>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-licorice">
                            <ArrowRightIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={onBackToMenu}
                        className="text-[11px] font-bold tracking-tight text-feldgrau transition-colors hover:text-licorice"
                    >
                        Or order something else
                    </button>
                </div>
            )}
        </main>
    );
}
