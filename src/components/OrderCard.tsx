import {
    CheckIcon,
    ClockIcon,
    PlayIcon,
} from "@heroicons/react/24/outline";

/* ────────────────────────── Types ────────────────────────── */

export type OrderStatus = "pending" | "preparing" | "ready";

export type OrderItem = {
    name: string;
    quantity: number;
    notes?: string;
};

export type KitchenOrder = {
    id: string;
    tableNumber: number;
    station: "Kitchen" | "Bar";
    items: OrderItem[];
    status: OrderStatus;
    /** ISO timestamp when the order was placed */
    placedAt: string;
    server: string;
};

type Props = {
    order: KitchenOrder;
    /** "now" tick from parent so all cards update in sync */
    now: number;
    onAdvance: (orderId: string) => void;
    onMarkReady: (orderId: string) => void;
    onMarkServed?: (orderId: string) => void;
};

/* ────────────────────────── Helpers ────────────────────────── */

function minutesSince(iso: string, now: number): number {
    const placed = new Date(iso).getTime();
    return Math.max(0, Math.floor((now - placed) / 60_000));
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

/** Returns urgency level based on minutes since order was placed. */
function getUrgency(mins: number): "fresh" | "warming" | "urgent" {
    if (mins < 10) return "fresh";
    if (mins < 20) return "warming";
    return "urgent";
}

const URGENCY_STYLES = {
    fresh: {
        ring: "ring-feldgrau/15",
        text: "text-feldgrau",
        dot: "bg-feldgrau",
    },
    warming: {
        ring: "ring-khaki/40",
        text: "text-khaki",
        dot: "bg-khaki",
    },
    urgent: {
        ring: "ring-dark-red/50",
        text: "text-dark-red",
        dot: "bg-dark-red",
    },
} as const;

const STATUS_LABEL: Record<OrderStatus, string> = {
    pending: "Pending",
    preparing: "Preparing",
    ready: "Ready",
};

/* ────────────────────────── Component ────────────────────────── */

export function OrderCard({ order, now, onAdvance, onMarkReady, onMarkServed }: Props) {
    const elapsed = minutesSince(order.placedAt, now);
    const urgency = getUrgency(elapsed);
    const styles = URGENCY_STYLES[urgency];

    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const hasNotes = order.items.some((item) => item.notes);

    return (
        <article
            className={`
                animate-velvet-rise
                flex flex-col overflow-hidden rounded-2xl bg-white
                shadow-[0_4px_16px_rgba(35,20,12,0.08)]
                ring-1 ${styles.ring}
                transition-all duration-200
                hover:shadow-[0_12px_28px_rgba(35,20,12,0.12)]
            `}
        >
            {/* ── Top row: Table + station + timer ── */}
            <header className="flex items-center justify-between border-b border-isabelline px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-licorice px-2.5 py-1.5 text-isabelline">
                        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-isabelline/60">
                            Table
                        </span>
                        <span className="font-serif text-[18px] font-black leading-none tracking-[-0.04em]">
                            {String(order.tableNumber).padStart(2, "0")}
                        </span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-feldgrau">
                            {order.station}
                        </span>
                        <span className="text-[10px] font-medium tracking-tight text-feldgrau/80">
                            {order.server}
                        </span>
                    </div>
                </div>

                {/* Elapsed timer */}
                <div className={`flex items-center gap-1 ${styles.text}`}>
                    <ClockIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    <span className="font-mono text-[13px] font-bold tabular-nums">
                        {formatDuration(elapsed)}
                    </span>
                </div>
            </header>

            {/* ── Items list ── */}
            <div className="flex-1 px-4 py-3">
                <ul className="space-y-1.5">
                    {order.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-khaki/15 font-mono text-[11px] font-black tabular-nums text-khaki">
                                {item.quantity}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-bold leading-tight tracking-tight text-licorice">
                                    {item.name}
                                </p>
                                {item.notes && (
                                    <p className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-dark-red/8 px-1.5 py-0.5 text-[10px] font-bold tracking-tight text-dark-red">
                                        ⚠ {item.notes}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Items count footer */}
                <div className="mt-2 flex items-center justify-between border-t border-isabelline pt-2 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                    <span>{totalItems} item{totalItems > 1 ? "s" : ""}</span>
                    {hasNotes && (
                        <span className="inline-flex items-center gap-1 text-dark-red">
                            <span className="h-1.5 w-1.5 rounded-full bg-dark-red" />
                            Notes
                        </span>
                    )}
                </div>
            </div>

            {/* ── Status action button ── */}
            <div className="border-t border-isabelline p-2">
                {order.status === "pending" && (
                    <button
                        type="button"
                        onClick={() => onAdvance(order.id)}
                        aria-label="Start preparing"
                        className="
                            flex w-full items-center justify-center gap-1.5
                            rounded-xl bg-licorice px-4 py-2.5
                            text-[12px] font-bold tracking-tight text-isabelline
                            shadow-[0_4px_12px_rgba(35,20,12,0.18)]
                            transition-all duration-150
                            hover:bg-licorice/95
                            active:scale-[0.98]
                        "
                    >
                        <PlayIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Start Preparing
                    </button>
                )}

                {order.status === "preparing" && (
                    <button
                        type="button"
                        onClick={() => onMarkReady(order.id)}
                        aria-label="Mark as ready"
                        className="
                            flex w-full items-center justify-center gap-1.5
                            rounded-xl bg-khaki px-4 py-2.5
                            text-[12px] font-bold tracking-tight text-licorice
                            shadow-[0_4px_12px_rgba(143,106,55,0.25)]
                            transition-all duration-150
                            hover:brightness-105
                            active:scale-[0.98]
                        "
                    >
                        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Mark Ready
                    </button>
                )}

                {order.status === "ready" &&
                    (onMarkServed ? (
                        <button
                            type="button"
                            onClick={() => onMarkServed(order.id)}
                            aria-label="Mark as served"
                            className="
                                flex w-full items-center justify-center gap-1.5
                                rounded-xl bg-feldgrau px-4 py-2.5
                                text-[12px] font-bold tracking-tight text-isabelline
                                shadow-[0_4px_12px_rgba(58,66,63,0.25)]
                                transition-all duration-150
                                hover:brightness-110
                                active:scale-[0.98]
                            "
                        >
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Mark Served
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-khaki/15 px-4 py-2.5 text-[12px] font-bold tracking-tight text-khaki">
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Ready for pickup
                        </div>
                    ))}
            </div>
        </article>
    );
}

export { STATUS_LABEL };
