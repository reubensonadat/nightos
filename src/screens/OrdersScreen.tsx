import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";
import type { OrderSummary } from "./OrderTrackingScreen";
import { OrderTrackingScreen } from "./OrderTrackingScreen";

/* ────────────────────────── Tracking stages ────────────────────────── */

type StageId = "received" | "preparing" | "on_the_way" | "served";

const STAGES: { id: StageId; label: string; description: string; activatesAtMs: number }[] = [
  { id: "received", label: "Order Received", description: "Sent to the kitchen", activatesAtMs: 0 },
  { id: "preparing", label: "In Preparation", description: "The team is crafting your order", activatesAtMs: 3_000 },
  { id: "on_the_way", label: "On Its Way", description: "Heading to your table", activatesAtMs: 8_000 },
  { id: "served", label: "Served", description: "Enjoy — your order has arrived", activatesAtMs: 15_000 },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ────────────────────────── Props ────────────────────────── */

type Props = {
  activeOrders: OrderSummary[];
  history: OrderSummary[];
  onPayBill: (order: OrderSummary) => void;
  onReorder?: (order: OrderSummary) => void;
};

/* ────────────────────────── Active Order Card ────────────────────────── */

function ActiveOrderCard({ order, onClick }: { order: OrderSummary; onClick: () => void }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const elapsed = now - order.sentAt;

  const currentStage = useMemo(() => {
    const active = [...STAGES].reverse().find((s) => elapsed >= s.activatesAtMs);
    return active ?? STAGES[0];
  }, [elapsed]);

  const isServed = currentStage.id === "served";

  const servedStage = STAGES[STAGES.length - 1];
  const msUntilServed = servedStage.activatesAtMs - elapsed;
  const etaLabel = msUntilServed <= 0 ? "Now" : msUntilServed < 60_000 ? "< 1 min" : `${Math.ceil(msUntilServed / 60_000)} min`;

  return (
    <button type="button" onClick={onClick} className="w-full text-left overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline transition-all hover:shadow-md active:scale-[0.99]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
            {isServed ? "Served" : `${currentStage.label} · ${etaLabel}`}
          </p>
          <p className="text-[12px] font-bold tracking-tight text-licorice">
            Order #{order.orderNumber}
          </p>
        </div>
        <span className="font-mono text-[15px] font-bold tabular-nums text-licorice">
          {formatGHS(order.total)}
        </span>
      </div>



      {/* Footer link to Order Tracking Screen */}
      <div className="flex w-full items-center justify-between border-t border-isabelline px-4 py-3 bg-isabelline/10 hover:bg-isabelline/30 transition-colors">
        <span className="text-[10px] font-semibold tracking-tight text-feldgrau">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </span>
        <span className="text-[10px] font-bold tracking-wider uppercase text-khaki flex items-center gap-1">
          Track details <ArrowRightIcon className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
    </button>
  );
}

/* ────────────────────────── History Card ────────────────────────── */

function HistoryCard({ order, onClick }: { order: OrderSummary; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-isabelline transition-all hover:shadow-md active:scale-[0.99]">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold tracking-tight text-licorice">Order #{order.orderNumber}</p>
        <p className="text-[10px] text-feldgrau">{order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {formatDate(order.sentAt)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[13px] font-bold tabular-nums text-khaki">{formatGHS(order.total)}</span>
        <ArrowRightIcon className="h-4 w-4 text-feldgrau/50" />
      </div>
    </button>
  );
}

/* ────────────────────────── Main Screen ────────────────────────── */

export function OrdersScreen({ activeOrders, history, onPayBill, onReorder }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);

  const hasActive = activeOrders.length > 0;
  const hasHistory = history.length > 0;

  // Render the detailed Order Tracking Screen if an order is selected
  if (selectedOrder) {
    return (
      <div className="absolute inset-0 z-50 bg-isabelline">
        <OrderTrackingScreen 
          order={selectedOrder} 
          onBackToMenu={() => setSelectedOrder(null)} 
          onPayBill={() => onPayBill(selectedOrder)} 
        />
      </div>
    );
  }

  if (!hasActive && !hasHistory) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-isabelline ring-1 ring-licorice/8">
          <ClipboardIcon className="h-6 w-6 text-feldgrau" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-[18px] font-bold tracking-tight text-licorice">No orders yet</h2>
        <p className="mt-1.5 max-w-[260px] text-[12px] leading-[1.5] text-feldgrau">
          Your orders and history will appear here once you place one.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 pt-6 pb-[calc(80px+env(safe-area-inset-bottom))] mx-auto w-full max-w-3xl">
      {/* ── Active Orders ── */}
      {hasActive && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-khaki opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-khaki" />
            </span>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-licorice">
              Active {activeOrders.length > 1 ? `(${activeOrders.length})` : ""}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {activeOrders.map((o) => (
              <div key={o.orderNumber} className="relative">
                <ActiveOrderCard order={o} onClick={() => setSelectedOrder(o)} />
                {/* Check if served, show pay button */}
                {(() => {
                  const elapsed = Date.now() - o.sentAt;
                  const served = elapsed >= STAGES[3].activatesAtMs;
                  if (!served) return null;
                  return (
                    <div className="mt-2">
                      <button type="button" onClick={() => onPayBill(o)}
                        className="flex w-full items-center justify-between rounded-full bg-licorice px-5 py-3 text-[13px] font-bold text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.985]"
                      >
                        <span>Pay {formatGHS(o.total)}</span>
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {hasHistory && (
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-feldgrau">
            History {history.length > 0 ? `(${history.length})` : ""}
          </h2>
          <div className="flex flex-col gap-2">
            {history.map((o) => (
              <HistoryCard key={o.orderNumber} order={o} onClick={() => setSelectedOrder(o)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  );
}
