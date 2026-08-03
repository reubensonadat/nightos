import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";
import { STAGES, statusStage, type OrderSummary } from "./OrderTrackingScreen";

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

function ActiveOrderCard({ order }: { order: OrderSummary }) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  const currentStage = useMemo(() => statusStage(order.status), [order.status]);
  const currentIndex = STAGES.indexOf(currentStage);
  const isServed = currentStage.id === "served";

  if (order.status === "cancelled" || order.cancelled) {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-red-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">Cancelled by staff</p>
            <p className="text-[12px] font-bold tracking-tight text-licorice">Order #{order.orderNumber}</p>
          </div>
          <span className="font-mono text-[15px] font-bold tabular-nums text-feldgrau/50 line-through">
            {formatGHS(order.total)}
          </span>
        </div>
        <div className="px-4 pb-4">
          <p className="text-[11.5px] leading-relaxed text-feldgrau">
            This order was cancelled at the venue. You haven't been charged — order again or pay only for what was
            served.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
            {isServed ? "Served" : `${currentStage.label} · live`}
          </p>
          <p className="text-[12px] font-bold tracking-tight text-licorice">
            Order #{order.orderNumber}
          </p>
        </div>
        <span className="font-mono text-[15px] font-bold tabular-nums text-licorice">
          {formatGHS(order.total)}
        </span>
      </div>

      {/* Timeline */}
      <div className="px-4 pb-3">
        <div className="relative">
          <div aria-hidden="true" className="absolute left-[9px] top-2 bottom-2 w-px bg-licorice/10" />
          <div aria-hidden="true" className="absolute left-[9px] top-2 w-px bg-licorice transition-all duration-700 ease-out"
            style={{ height: `${(currentIndex / (STAGES.length - 1)) * 100}%` }}
          />
          {STAGES.map((stage, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div key={stage.id} className="relative flex items-start gap-3 pb-3 last:pb-0">
                <div className="relative z-10 flex shrink-0 items-center justify-center pt-0.5">
                  <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full transition-all duration-500 ${
                    isPast ? "bg-licorice" : isCurrent ? "bg-licorice ring-4 ring-khaki/30" : "bg-white ring-1 ring-licorice/15"
                  }`}>
                    {isPast ? <CheckIcon className="h-2.5 w-2.5 text-isabelline" strokeWidth={3} /> :
                     isCurrent && !isServed ? <span className="h-1.5 w-1.5 rounded-full bg-khaki animate-pulse" /> :
                     isCurrent && isServed ? <CheckCircleIcon className="h-3 w-3 text-khaki" /> :
                     <span className="h-1 w-1 rounded-full bg-licorice/20" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-[11px] font-bold tracking-tight ${isPast || isCurrent ? "text-licorice" : "text-feldgrau/50"}`}>
                    {stage.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary toggle */}
      <button type="button" onClick={() => setSummaryOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-isabelline px-4 py-2 text-[10px] font-semibold tracking-tight text-feldgrau hover:bg-isabelline/30 transition-colors"
      >
        {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${summaryOpen ? "rotate-180" : ""}`} strokeWidth={2.25} />
      </button>
      {summaryOpen && (
        <div className="border-t border-isabelline px-4 py-2 animate-velvet-fade space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-licorice">×{item.qty} {item.name}</span>
              <span className="font-mono font-bold tabular-nums text-feldgrau">{formatGHS(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── History Card ────────────────────────── */

function HistoryCard({ order }: { order: OrderSummary }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-isabelline">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold tracking-tight text-licorice">Order #{order.orderNumber}</p>
          {order.cancelled && (
            <span className="rounded-full bg-red-50 ring-1 ring-red-200 text-red-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              Cancelled
            </span>
          )}
        </div>
        <p className="text-[10px] text-feldgrau">{order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {formatDate(order.sentAt)}</p>
      </div>
      <span className="font-mono text-[13px] font-bold tabular-nums text-khaki">{formatGHS(order.total)}</span>
    </div>
  );
}

/* ────────────────────────── Main Screen ────────────────────────── */

export function OrdersScreen({ activeOrders, history, onPayBill, onReorder: _onReorder }: Props) {
  const navigate = useNavigate();
  const hasActive = activeOrders.length > 0;
  const hasHistory = history.length > 0;

  return (
    <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3 relative">
          <button
            type="button"
            onClick={() => navigate("/tab")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
          >
            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
          </button>

          <h1 className="text-[16px] font-bold tracking-tight text-licorice absolute left-1/2 -translate-x-1/2">
            Orders
          </h1>

          <div className="flex items-center gap-1.5 rounded-full border border-licorice/15 bg-licorice/5 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-licorice">
              Table 4
            </span>
          </div>
        </div>
      </header>

      {!hasActive && !hasHistory ? (
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-5 md:px-8 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-isabelline ring-1 ring-licorice/8">
            <ClipboardDocumentListIcon className="h-6 w-6 text-feldgrau" />
          </div>
          <h2 className="mt-4 text-[18px] font-bold tracking-tight text-licorice">No orders yet</h2>
          <p className="mt-1.5 max-w-[260px] text-[12px] leading-[1.5] text-feldgrau">
            Your orders and history will appear here once you place one.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-6 pb-[calc(80px+env(safe-area-inset-bottom))]">
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
                <ActiveOrderCard order={o} />
                {/* Real status: only show pay when the kitchen marked it served */}
                {statusStage(o.status).id === "served" && (
                  <div className="mt-2">
                    <button type="button" onClick={() => onPayBill(o)}
                      className="flex w-full items-center justify-between rounded-full bg-licorice px-5 py-3 text-[13px] font-bold text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.985]"
                    >
                      <span>Pay {formatGHS(o.total)}</span>
                      <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
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
              <HistoryCard key={o.orderNumber} order={o} />
            ))}
          </div>
        </div>
      )}
      </div>
      )}
    </main>
  );
}
