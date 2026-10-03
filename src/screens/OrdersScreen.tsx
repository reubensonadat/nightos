import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";
import { db, type DbOrderItem, type DbBill } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";
import { ReceiptDownloader } from "../components/ReceiptDownloader";
import { STAGES, statusStage, type OrderSummary } from "./OrderTrackingScreen";
import { ProfessionalReceipt } from "../components/ProfessionalReceipt";
import { TablePinBanner } from "../components/TablePinBanner";

function formatOrderTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", hour12: true });
  if (isToday) {
    return timeStr;
  }
  return `${d.toLocaleDateString("en-GH", { month: "short", day: "numeric" })}, ${timeStr}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusLabelFor(order: OrderSummary): string {
  if (order.cancelled) return "Cancelled";
  return order.status ? statusStage(order.status).label : "Confirmed";
}

/* ────────────────────────── Props ────────────────────────── */

type Props = {
  activeOrders: OrderSummary[];
  history: OrderSummary[];
  tableLabel?: string | null;
  tablePin?: string | null;
  billId?: string | null;
  sessionToken?: string | null;
  onPayBill: (order: OrderSummary) => void;
  onReorder?: (order: OrderSummary) => void;
  onCallWaiter?: () => void;
  callingWaiter?: boolean;
  waiterCalled?: boolean;
};

/* ────────────────────────── Active Order Card ────────────────────────── */

function ActiveOrderCard({ order }: { order: OrderSummary }) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  const currentStage = useMemo(() => statusStage(order.status), [order.status]);
  const currentIndex = STAGES.indexOf(currentStage);
  const isServed = currentStage.id === "served";

  if (order.status === "cancelled" || order.cancelled) {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-red-100">
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-isabelline">
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

/* ────────────────────────── Receipt Modal ────────────────────────── */

type ReceiptModalProps = {
  order: OrderSummary;
  venueName?: string | null;
  sessionToken?: string | null;
  depositCovered?: boolean;
  onPayBill?: (order: OrderSummary) => void;
  onClose: () => void;
};

function ReceiptModal({ order, venueName, sessionToken, depositCovered, onPayBill, onClose }: ReceiptModalProps) {
  const [items, setItems] = useState<DbOrderItem[] | null>(null);
  const [tableLabel, setTableLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrintable, setShowPrintable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (order.submissionId || order.billId) {
      setLoading(true);
      Promise.all([
        order.submissionId
          ? db.orderItemsBySubmission(order.submissionId, sessionToken)
          : Promise.resolve({ data: null }),
        order.billId ? db.customerBill(order.billId, sessionToken) : Promise.resolve({ data: null }),
      ])
        .then(([itemsRes, billRes]) => {
          if (cancelled) return;
          const activeItems = (itemsRes.data ?? []).filter((i) => i.status !== 'cancelled');
          if (activeItems.length > 0) setItems(activeItems);
          if (billRes.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tbl = (Array.isArray(billRes.data.tables) ? billRes.data.tables[0] : billRes.data.tables) as any;
            if (tbl?.table_label) setTableLabel(tbl.table_label);
          }
        })
        .catch((err) => console.error("Error loading receipt details:", err))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [order.submissionId, order.billId, sessionToken]);

  // Items shown from DB submission when available, else the summary snapshot for this order.
  const shownItems =
    items && items.length > 0
      ? items.map((i) => ({ name: i.product_name, qty: i.quantity, lineTotal: Number(i.line_total) }))
      : order.items.map((i) => ({ name: i.name, qty: i.qty, lineTotal: i.lineTotal }));

  const itemsSubtotal = shownItems.reduce((s, i) => s + i.lineTotal, 0) || order.total;
  const receiptTotal = order.total > 0 ? order.total : itemsSubtotal;
  const vat = Math.max(0, Math.round((receiptTotal - itemsSubtotal) * 100) / 100);
  const stamp = new Date(order.sentAt).toISOString();

  const formattedTable = tableLabel
    ? (tableLabel.trim().toLowerCase().startsWith("table") ? tableLabel : `Table ${tableLabel}`)
    : (venueName || "Bysen");

  const statusDisplay = statusLabelFor(order);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-licorice/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md animate-velvet-scale-in rounded-t-3xl sm:rounded-3xl bg-isabelline shadow-[0_24px_80px_rgba(35,20,12,0.35)] max-h-[92svh] overflow-y-auto no-scrollbar pb-6">
        {/* Handle + header */}
        <div className="sticky top-0 z-10 rounded-t-3xl sm:rounded-t-3xl border-b border-licorice/8 bg-isabelline/95 backdrop-blur-xl px-5 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-licorice/15" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                Order #{order.orderNumber}
              </p>
              <p className="text-[15px] font-black tracking-[-0.02em] text-licorice">
                {formattedTable} · {formatOrderTime(order.sentAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
            >
              <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="px-5 pt-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Itemized List ── */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-licorice/8">
                <div className="flex items-center justify-between border-b border-licorice/8 pb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                    Items ({shownItems.reduce((acc, i) => acc + i.qty, 0)})
                  </span>
                  <span className="rounded-full bg-licorice/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                    {statusDisplay}
                  </span>
                </div>

                <div className="divide-y divide-licorice/5 pt-1">
                  {shownItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5 text-[13px]">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-mono font-bold text-licorice shrink-0">{it.qty}x</span>
                        <span className="truncate font-medium text-licorice">{it.name}</span>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-licorice shrink-0">
                        {formatGHS(it.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Total */}
                <div className="mt-2 space-y-1.5 border-t border-licorice/8 pt-3 text-[12px]">
                  <div className="flex items-center justify-between text-feldgrau">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold tabular-nums">{formatGHS(itemsSubtotal)}</span>
                  </div>
                  {vat > 0 && (
                    <div className="flex items-center justify-between text-feldgrau">
                      <span>VAT</span>
                      <span className="font-mono font-bold tabular-nums">{formatGHS(vat)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 text-[14px] font-black text-licorice">
                    <span>Order Total</span>
                    <span className="font-mono text-[16px] tabular-nums text-khaki">
                      {formatGHS(receiptTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Order Action Buttons ── */}
              <div className="space-y-2.5 pt-1">
                {!order.cancelled && (
                  depositCovered ? (
                    <div className="rounded-2xl bg-khaki/10 py-3.5 px-4 text-center ring-1 ring-khaki/30">
                      <span className="text-[12.5px] font-bold text-khaki">
                        ✦ Covered by Prepaid Table Deposit
                      </span>
                    </div>
                  ) : onPayBill ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPayBill(order);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-licorice py-3.5 px-5 text-[14px] font-bold text-khaki shadow-[0_8px_20px_rgba(35,20,12,0.25)] transition-all hover:bg-licorice/90 active:scale-[0.98]"
                    >
                      <span>Pay This Order</span>
                      <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  ) : null
                )}

                {/* ── Print Receipt Button ── */}
                <button
                  type="button"
                  onClick={() => setShowPrintable((v) => !v)}
                  className="flex w-full items-center justify-center rounded-full border border-licorice/15 bg-white py-3.5 px-5 text-[13.5px] font-bold text-licorice shadow-xs transition-all hover:bg-isabelline active:scale-[0.98]"
                >
                  <span>{showPrintable ? "Hide Receipt" : "Print Receipt"}</span>
                </button>
              </div>

              {showPrintable && (
                <div className="mt-2 animate-velvet-fade">
                  <ReceiptDownloader fileName={`Receipt-${order.orderNumber}.png`}>
                    <ProfessionalReceipt
                      venueName={venueName || "Bysen"}
                      refCode={order.orderNumber}
                      dateISO={stamp}
                      statusLabel={statusDisplay}
                      servedLabel={formattedTable}
                      items={shownItems}
                      subtotal={itemsSubtotal}
                      vat={vat}
                      total={receiptTotal}
                    />
                  </ReceiptDownloader>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── History Card ────────────────────────── */

function HistoryCard({
  order,
  venueName,
  sessionToken,
  depositCovered,
  onPayBill,
}: {
  order: OrderSummary;
  venueName?: string | null;
  sessionToken?: string | null;
  depositCovered?: boolean;
  onPayBill?: (order: OrderSummary) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-licorice/8 transition-all hover:ring-khaki/30 active:scale-[0.99]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-isabelline/20"
        >
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2">
              <p className="whitespace-nowrap text-[13px] font-bold tracking-tight text-licorice">
                Order #{order.orderNumber}
              </p>
              {order.cancelled ? (
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500 ring-1 ring-red-200">
                  Cancelled
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-licorice/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau ring-1 ring-licorice/10">
                  {statusLabelFor(order)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-feldgrau">
              {order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {formatOrderTime(order.sentAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`font-mono text-[14.5px] font-bold tabular-nums ${
                order.cancelled ? "text-feldgrau/40 line-through" : "text-khaki"
              }`}
            >
              {formatGHS(order.total)}
            </span>
            <ChevronRightIcon className="h-4 w-4 text-feldgrau/40" strokeWidth={2.25} />
          </div>
        </button>
      </div>
      {open && (
        <ReceiptModal
          order={order}
          venueName={venueName}
          sessionToken={sessionToken}
          depositCovered={depositCovered}
          onPayBill={onPayBill}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ────────────────────────── Main Screen ────────────────────────── */

export function OrdersScreen({ activeOrders, history, tableLabel, tablePin, billId: _billId, sessionToken, venueName, onPayBill, onReorder: _onReorder, onBack, onCallWaiter, callingWaiter, waiterCalled }: Props & { venueName?: string | null; onBack?: () => void }) {
  void _onReorder;
  const navigate = useNavigate();
  const hasActive = activeOrders.length > 0;
  const hasHistory = history.length > 0;

  const [bill, setBill] = useState<DbBill | null>(null);

  useEffect(() => {
    if (!_billId) return;
    let active = true;
    db.billById(_billId).then(({ data }) => {
      if (active && data) setBill(data as DbBill);
    });
    return () => {
      active = false;
    };
  }, [_billId]);

  useRealtime({
    table: 'bills',
    filter: _billId ? `id=eq.${_billId}` : undefined,
    onUpdate: (updatedRow: Record<string, unknown>) => {
      setBill((prev) => (prev ? ({ ...prev, ...updatedRow } as DbBill) : null));
    },
  });

  const depositAmount = Number(bill?.deposit_amount || 0);
  const depositPaid = Boolean(bill?.deposit_paid);

  const activeSpend = useMemo(
    () => [...activeOrders, ...history].filter((o) => !o.cancelled).reduce((sum, o) => sum + o.total, 0),
    [activeOrders, history]
  );

  const billRemainingBalance = bill
    ? Math.max(0, Math.round((Number(bill.total || 0) - Number(bill.amount_paid || 0)) * 100) / 100)
    : (depositPaid && depositAmount > 0
        ? Math.max(0, Math.round((activeSpend - depositAmount) * 100) / 100)
        : activeSpend);

  const remainingCredit = depositPaid && depositAmount > 0
    ? (bill?.remaining_credit !== undefined && bill?.remaining_credit !== null
        ? Number(bill.remaining_credit)
        : Math.max(0, Math.round((depositAmount - activeSpend) * 100) / 100))
    : 0;

  const isDepositCovered = depositPaid && depositAmount > 0 && billRemainingBalance === 0;

  const payableOrder = useMemo(
    () =>
      [...activeOrders, ...history].find((o) => !o.cancelled && o.status === "served") ||
      [...activeOrders, ...history].find((o) => !o.cancelled && o.status === "ready") ||
      [...activeOrders, ...history].find((o) => !o.cancelled) ||
      null,
    [activeOrders, history]
  );

  return (
    <main className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3 relative">
          <button
            type="button"
            onClick={() => onBack ? onBack() : navigate(-1)}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
          >
            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
          </button>

          <h1 className="text-[16px] font-bold tracking-tight text-licorice absolute left-1/2 -translate-x-1/2">
            Orders
          </h1>
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
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-6 pb-[calc(140px+env(safe-area-inset-bottom))]">
          {/* ── Active Orders ── */}
          {hasActive && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-licorice">
                  Active {activeOrders.length > 1 ? `(${activeOrders.length})` : ""}
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {activeOrders.map((o) => (
                  <div key={o.orderNumber} className="relative">
                    <ActiveOrderCard order={o} />
                    {statusStage(o.status).id === "served" && !isDepositCovered && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => onPayBill(o)}
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
                  <HistoryCard
                    key={o.orderNumber}
                    order={o}
                    venueName={venueName}
                    sessionToken={sessionToken}
                    depositCovered={isDepositCovered}
                    onPayBill={onPayBill}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Bottom Payment Banner ── */}
      {(activeSpend > 0 || billRemainingBalance > 0) && (
        <div className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-5 max-w-7xl mx-auto">
          {isDepositCovered ? (
            <div className="rounded-2xl bg-licorice px-5 py-3.5 shadow-[0_12px_32px_rgba(35,20,12,0.35)] ring-1 ring-khaki/30 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                  Credit Remaining
                </p>
                <p className="font-mono text-[20px] font-black tracking-tight text-isabelline mt-0.5">
                  {formatGHS(remainingCredit)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/45">
                  Spent
                </p>
                <p className="font-mono text-[14px] font-bold text-isabelline/80 mt-0.5">
                  {formatGHS(activeSpend)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-licorice p-4 shadow-[0_12px_32px_rgba(35,20,12,0.35)] ring-1 ring-white/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-khaki">
                  {depositPaid && depositAmount > 0 ? "Amount Due Now" : "Total Tab Balance"}
                </p>
                <p className="font-mono text-xl font-black tracking-tight text-isabelline">
                  {formatGHS(billRemainingBalance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (payableOrder) {
                    onPayBill(payableOrder);
                  } else {
                    onPayBill({
                      orderNumber: _billId ? _billId.slice(0, 8).toUpperCase() : "BILL",
                      total: billRemainingBalance,
                      itemCount: 1,
                      items: [],
                      sentAt: Date.now(),
                      billId: _billId ?? undefined,
                    });
                  }
                }}
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-khaki px-5 py-3 text-[13px] font-bold tracking-tight text-licorice whitespace-nowrap transition-all hover:bg-khaki/90 active:scale-95 shadow-sm"
              >
                <span>Pay Bill →</span>
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}