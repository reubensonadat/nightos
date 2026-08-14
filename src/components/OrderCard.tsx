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
    isAllergy?: boolean;
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

function secondsSince(iso: string, now: number): number {
    const placed = new Date(iso).getTime();
    return Math.max(0, Math.floor((now - placed) / 1000));
}

function formatDuration(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
        text: "text-emerald-700",
        dot: "bg-feldgrau",
    },
    warming: {
        ring: "ring-khaki/40",
        text: "text-amber-600",
        dot: "bg-khaki",
    },
    urgent: {
        ring: "ring-dark-red/50",
        text: "text-red-600 font-bold animate-pulse",
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
    const elapsedSeconds = secondsSince(order.placedAt, now);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const urgency = getUrgency(elapsedMinutes);
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
                    <div className="flex flex-col items-center justify-center rounded-lg bg-licorice px-2 py-1 text-isabelline">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-isabelline/60">
                            Table
                        </span>
                        <span className="font-sans font-bold text-lg tabular-nums leading-none tracking-[-0.04em]">
                            {String(order.tableNumber).padStart(2, "0")}
                        </span>
                    </div>
                </div>

                {/* Elapsed timer */}
                <div className={`flex items-center gap-1 ${styles.text}`}>
                    <span className="text-lg tabular-nums tracking-tight">
                        {formatDuration(elapsedSeconds)}
                    </span>
                </div>
            </header>

            {/* ── Items list ── */}
            <div className="flex-1 px-4 py-3">
                <ul className="space-y-2.5">
                    {order.items.map((item, idx) => (
                        <li key={idx} className="grid grid-cols-[28px_1fr] gap-2 items-center">
                            <span className="text-base font-medium text-slate-400 tabular-nums text-left leading-tight">
                                {item.quantity}x
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold text-slate-900 leading-tight tracking-tight">
                                    {item.name}
                                </p>
                                {item.notes && (
                                    <p className={`mt-0.5 flex items-center text-sm font-normal ${item.isAllergy ? "text-dark-red" : "text-slate-500"}`}>
                                        {item.isAllergy && "⚠ "}{item.notes}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {/* Items count footer */}
                <div className="mt-2 flex items-center justify-between border-t border-isabelline pt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                    <span>{totalItems} item{totalItems > 1 ? "s" : ""}</span>
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
                            text-base font-bold tracking-tight text-isabelline
                            shadow-[0_4px_12px_rgba(35,20,12,0.18)]
                            transition-all duration-150
                            hover:bg-licorice/95
                            active:scale-[0.98]
                        "
                    >
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
                            text-base font-bold tracking-tight text-licorice
                            shadow-[0_4px_12px_rgba(143,106,55,0.25)]
                            transition-all duration-150
                            hover:brightness-105
                            active:scale-[0.98]
                        "
                    >
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
                                text-base font-bold tracking-tight text-isabelline
                                shadow-[0_4px_12px_rgba(58,66,63,0.25)]
                                transition-all duration-150
                                hover:brightness-110
                                active:scale-[0.98]
                            "
                        >
                            Mark Served
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-khaki/15 px-4 py-2.5 text-base font-bold tracking-tight text-khaki">
                            Ready for pickup
                        </div>
                    ))}
            </div>
        </article>
    );
}

export { STATUS_LABEL };
