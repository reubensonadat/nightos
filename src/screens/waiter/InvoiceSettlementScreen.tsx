import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CheckCircleIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";
import { ReceiptDownloader } from "../../components/ReceiptDownloader";
import { ProfessionalReceipt } from "../../components/ProfessionalReceipt";
import type { Table } from "./TablesDashboard";
import { ConfirmModal } from "../../components/ConfirmModal";

/* ────────────────────────── Payment methods ────────────────────────── */

type PaymentMethod = "cash" | "card" | "momo";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof BanknotesIcon }[] = [
    { id: "cash", label: "Cash", icon: BanknotesIcon },
    { id: "card", label: "Card", icon: CreditCardIcon },
    { id: "momo", label: "MoMo", icon: DevicePhoneMobileIcon },
];

const QUICK_CASH = [50, 100, 200, 500];

type BillItem = {
    id: string;
    product_name: string;
    quantity: number;
    line_total: number;
};

/* ────────────────────────── Component ────────────────────────── */

export function InvoiceSettlementScreen() {
    const { table, staffId, venueId } = useOutletContext<{ table: Table; venueId: string; staffId: string }>();
    const navigate = useNavigate();
    const onBack = () => navigate(`/waiter/table/${table.id}`);
    const onSettled = () => navigate('/waiter');
    const [method, setMethod] = useState<PaymentMethod>("cash");
    const [cashReceived, setCashReceived] = useState<string>("");
    const [settled, setSettled] = useState(false);
    const [settling, setSettling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fee, setFee] = useState<number | null>(null);
    const [bill, setBill] = useState<{
        id: string;
        subtotal: number;
        service_charge: number;
        vat: number;
        total: number;
        status: string;
    } | null>(null);
    const [items, setItems] = useState<BillItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [invoiceNo] = useState(() => `VL-${Date.now().toString(36).slice(-6).toUpperCase()}`);
    const [showInvoice, setShowInvoice] = useState(false);
    const [venueName, setVenueName] = useState<string | null>(null);
    const [settleConfirmOpen, setSettleConfirmOpen] = useState(false);

    /* ── Load the real open bill for this table ── */
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const { data: billRow } = await db.openBillForTable(table.id);
            if (cancelled) return;
db.venueById(venueId).then(
                ({ data }) => { if (!cancelled && data) setVenueName(data.name); },
                () => {},
            );
            if (!billRow || billRow.status !== 'open') {
                setBill(null);
                setLoading(false);
                return;
            }
            db.venueById(billRow.venue_id).then(
                ({ data }) => { if (!cancelled && data) setVenueName(data.name); },
                () => {},
            );
            const { data: itemRows } = await db.billItems(billRow.id);
            if (cancelled) return;
            setBill({
                id: billRow.id,
                subtotal: Number(billRow.subtotal),
                service_charge: Number(billRow.service_charge),
                vat: Number(billRow.vat),
                total: Number(billRow.total),
                status: billRow.status,
            });
            setItems((itemRows ?? []).map((r) => ({
                id: r.id,
                product_name: r.product_name,
                quantity: r.quantity,
                line_total: Number(r.line_total),
            })));
            setLoading(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table.id]);

    const total = bill?.total ?? 0;
    const received = parseFloat(cashReceived) || 0;
    const change = received - total;
    const canSettle = method === "cash" && received >= total && !!bill;

    const handleSettle = async () => {
        if (!canSettle || !bill) return;
        setSettling(true);
        setError(null);
        const { data, error: dbError } = await db.recordCashPayment(bill.id, total, staffId);
        setSettling(false);
        if (dbError || !data?.ok) {
            setError(dbError ? "Couldn't record the payment — check your connection." : "That bill is no longer open.");
            return;
        }
        setFee(data.fee ?? null);
        setSettled(true);
    };

    /* ── Settled success state ── */
    if (settled && bill) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
                <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                    <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                        <button
                            type="button"
                            onClick={onSettled}
                            aria-label="Back to tables"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                        >
                            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        <div className="flex flex-col items-center leading-tight">
                            <span className="text-[13px] font-bold tracking-tight text-licorice">
                                Payment collected
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                                Cash
                            </span>
                        </div>
                        <div className="w-9" />
                    </div>
                </header>

                <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-10 pb-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-khaki/15">
                            <CheckCircleIcon className="h-8 w-8 text-khaki" strokeWidth={2} />
                        </div>
                        <h1 className="mt-4 text-[1.75rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                            Bill
                            <br />
                            <span className="italic font-serif font-bold text-khaki">settled</span>
                        </h1>
                        <p className="mt-2 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                            Cash confirmed for Table {String(table.number).padStart(2, "0")}.
                        </p>
                    </div>

                    {/* Invoice card */}
                    <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(35,20,12,0.08)] ring-1 ring-isabelline">
                        <div className="bg-licorice px-5 py-4 text-isabelline">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                        Invoice
                                    </p>
                                    <p className="mt-0.5 font-mono text-[14px] font-bold tabular-nums">
                                        {invoiceNo}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                        Table
                                    </p>
                                    <p className="mt-0.5 font-serif text-[18px] font-bold leading-none">
                                        {String(table.number).padStart(2, "0")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {items.length === 0 && (
                                <p className="text-[12px] tracking-tight text-feldgrau">
                                    No line items recorded.
                                </p>
                            )}
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between py-1.5 text-[12px]"
                                >
                                    <span className="tracking-tight text-licorice">
                                        {item.quantity}× {item.product_name}
                                    </span>
                                    <span className="font-mono font-bold tabular-nums text-licorice">
                                        {formatGHS(item.line_total)}
                                    </span>
                                </div>
                            ))}

                            <div className="mt-3 space-y-1 border-t border-isabelline pt-3 text-[11px]">
                                <div className="flex justify-between text-feldgrau">
                                    <span>Subtotal</span>
                                    <span className="font-mono tabular-nums">{formatGHS(bill.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-feldgrau">
                                    <span>Service charge</span>
                                    <span className="font-mono tabular-nums">{formatGHS(bill.service_charge)}</span>
                                </div>
                                <div className="flex justify-between text-feldgrau">
                                    <span>VAT</span>
                                    <span className="font-mono tabular-nums">{formatGHS(bill.vat)}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-licorice/10 pt-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-licorice">
                                    Total
                                </span>
                                <span className="font-mono text-[18px] font-black tabular-nums text-licorice">
                                    {formatGHS(bill.total)}
                                </span>
                            </div>

                            <div className="mt-3 rounded-lg bg-khaki/12 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-khaki">
                                Paid via Cash
                            </div>

                            {fee !== null && (
                                <div className="mt-2 rounded-lg bg-isabelline px-3 py-2 text-[10.5px] font-semibold tracking-tight text-feldgrau">
                                    Platform fee {formatGHS(fee)} — added to your monthly outstanding balance.
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onSettled}
                        className="mt-5 w-full rounded-full bg-licorice py-3.5 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985]"
                    >
                        Back to Tables
                    </button>
                </section>
            </main>
        );
    }

    /* ── Loading / no bill state ── */
    if (loading) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
            </main>
        );
    }

    if (!bill) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col items-center justify-center px-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-isabelline ring-1 ring-licorice/8">
                    <ExclamationTriangleIcon className="h-6 w-6 text-feldgrau" strokeWidth={1.75} />
                </div>
                <h1 className="mt-4 text-[18px] font-bold tracking-tight text-licorice">
                    No open bill
                </h1>
                <p className="mt-1.5 max-w-[260px] text-[12px] leading-[1.5] text-feldgrau">
                    Table {String(table.number).padStart(2, "0")} has no open bill to settle.
                </p>
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-6 rounded-full bg-licorice px-6 py-3 text-[12px] font-bold tracking-tight text-isabelline transition-all hover:bg-licorice/95 active:scale-[0.985]"
                >
                    Back
                </button>
            </main>
        );
    }

    /* ── Active settlement screen ── */
    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            Table {String(table.number).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            Collect Payment
                        </span>
                    </div>

                    <div className="w-9" />
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl flex-1 px-5 md:px-8 pt-5 pb-[100px]">
                {/* Bill summary card */}
                <div className="overflow-hidden rounded-2xl bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)]">
                    <div className="px-5 pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                Bill Summary
                            </p>
                            <p className="font-mono text-[10px] font-bold tabular-nums text-isabelline/60">
                                {items.length} items
                            </p>
                        </div>

                        <div className="mt-3 space-y-1.5">
                            {items.length === 0 && (
                                <p className="text-[11.5px] tracking-tight text-isabelline/70">
                                    No items yet — ask the customer to order first.
                                </p>
                            )}
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-2 text-[11.5px]"
                                >
                                    <span className="min-w-0 flex-1 truncate tracking-tight text-isabelline/90">
                                        {item.quantity}× {item.product_name}
                                    </span>
                                    <span className="shrink-0 font-mono font-bold tabular-nums">
                                        {formatGHS(item.line_total)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-isabelline/10 px-5 py-3">
                        <div className="space-y-0.5 text-[10.5px]">
                            <div className="flex justify-between text-isabelline/60">
                                <span>Subtotal</span>
                                <span className="font-mono tabular-nums">{formatGHS(bill.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-isabelline/60">
                                <span>Service charge</span>
                                <span className="font-mono tabular-nums">{formatGHS(bill.service_charge)}</span>
                            </div>
                            <div className="flex justify-between text-isabelline/60">
                                <span>VAT</span>
                                <span className="font-mono tabular-nums">{formatGHS(bill.vat)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-isabelline/10 px-5 py-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-isabelline/80">
                            Total Due
                        </span>
                        <span className="font-mono text-[20px] sm:text-[24px] font-black tabular-nums">
                            {formatGHS(total)}
                        </span>
                    </div>
                </div>

                {/* ── Invoice / receipt for the customer ── */}
                <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    <button
                        type="button"
                        onClick={() => setShowInvoice((v) => !v)}
                        className="flex w-full items-center justify-between text-left"
                    >
                        <div>
                            <p className="text-[12px] font-bold tracking-tight text-licorice">
                                Invoice for customer
                            </p>
                            <p className="mt-0.5 text-[10.5px] tracking-tight text-feldgrau">
                                {showInvoice ? "Hide the invoice preview" : "Let them see it and download the receipt"}
                            </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            {showInvoice ? "Close" : "Show"}
                        </span>
                    </button>

                    {showInvoice && bill && (
                        <div className="mt-3">
                            <ReceiptDownloader fileName={`Invoice-${bill.id.slice(0, 8).toUpperCase()}.png`}>
                                <ProfessionalReceipt
                                    venueName={venueName || "Bysen"}
                                    refCode={bill.id.slice(0, 8).toUpperCase()}
                                    dateISO={new Date().toISOString()}
                                    statusLabel={bill.status === "open" ? "Open" : bill.status}
                                    servedLabel={`Table ${String(table.number).padStart(2, "0")}`}
                                    items={items.map((i) => ({
                                        name: i.product_name,
                                        qty: i.quantity,
                                        lineTotal: i.line_total,
                                    }))}
                                    subtotal={bill.subtotal}
                                    vat={bill.vat}
                                    total={bill.total}
                                />
                            </ReceiptDownloader>
                        </div>
                    )}
                </div>

                {/* Payment method selector */}
                <div className="mt-5">
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                        Payment Method
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((m) => {
                            const Icon = m.icon;
                            const isActive = m.id === method;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMethod(m.id)}
                                    className={`
                                        flex flex-col items-center gap-1 rounded-xl py-3
                                        transition-all duration-150 active:scale-95
                                        ${isActive
                                            ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                            : "bg-white text-feldgrau ring-1 ring-isabelline hover:text-licorice"
                                        }
                                    `}
                                >
                                    <Icon className="h-4 w-4" strokeWidth={2} />
                                    <span className="text-[10px] font-bold tracking-tight">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Cash-specific UI */}
                {method === "cash" && (
                    <div className="mt-5 animate-velvet-fade">
                        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            Cash Received
                        </p>
                        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                            <div className="flex items-baseline gap-2 border-b border-isabelline pb-3">
                                <span className="shrink-0 text-[14px] font-bold text-feldgrau">GHS</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    autoFocus
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    placeholder="0.00"
                                    className="min-w-0 flex-1 bg-transparent font-mono text-[22px] sm:text-[24px] font-black tabular-nums text-licorice placeholder:text-feldgrau/30 focus:outline-none"
                                />
                            </div>

                            {/* Quick cash buttons */}
                            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
                                {QUICK_CASH.map((amt) => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setCashReceived(amt.toString())}
                                        className="rounded-full bg-isabelline px-3 py-2 text-[11px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 transition-all hover:bg-khaki/15 active:scale-95"
                                    >
                                        {formatGHS(amt)}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCashReceived(total.toString())}
                                    className="col-span-3 sm:col-auto rounded-full bg-licorice px-3 py-2 text-[11px] font-bold tracking-tight text-isabelline transition-all hover:bg-licorice/90 active:scale-95"
                                >
                                    Exact
                                </button>
                            </div>

                            {/* Change calculation */}
                            {received > 0 && (
                                <div className="mt-4 flex items-center justify-between rounded-xl bg-khaki/12 px-4 py-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-khaki">
                                        {change >= 0 ? "Change" : "Short"}
                                    </span>
                                    <span
                                        className={`font-mono text-[18px] font-black tabular-nums ${change >= 0 ? "text-khaki" : "text-dark-red"}`}
                                    >
                                        {formatGHS(Math.abs(change))}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Card-specific UI */}
                {method === "card" && (
                    <div className="mt-5 animate-velvet-fade rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-isabelline">
                        <CreditCardIcon className="mx-auto h-8 w-8 text-feldgrau" strokeWidth={1.5} />
                        <p className="mt-2 text-[12px] font-bold tracking-tight text-licorice">
                            Online payment
                        </p>
                        <p className="mt-1 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                            Card & MoMo are paid on the customer's phone — the platform takes its fee
                            automatically at checkout. Cash is recorded here.
                        </p>
                    </div>
                )}

                {/* MoMo-specific UI */}
                {method === "momo" && (
                    <div className="mt-5 animate-velvet-fade rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-isabelline">
                        <DevicePhoneMobileIcon className="mx-auto h-8 w-8 text-feldgrau" strokeWidth={1.5} />
                        <p className="mt-2 text-[12px] font-bold tracking-tight text-licorice">
                            Mobile Money
                        </p>
                        <p className="mt-1 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                            The customer pays from their own phone after checkout. Cash is recorded here.
                        </p>
                    </div>
                )}

                {error && (
                    <p className="mt-4 rounded-lg bg-dark-red/8 px-3 py-2 text-[11px] font-semibold tracking-tight text-dark-red">
                        {error}
                    </p>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 bg-isabelline/95 backdrop-blur-xl border-t border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                    <div className="flex min-w-0 flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                            To Collect
                        </span>
                        <span className="font-mono text-[15px] sm:text-[16px] font-black tabular-nums text-licorice">
                            {formatGHS(total)}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (method === "cash") {
                                setSettleConfirmOpen(true);
                            } else {
                                void handleSettle();
                            }
                        }}
                        disabled={!canSettle || settling}
                        className="
                            inline-flex shrink-0 items-center justify-center gap-1.5
                            rounded-full bg-licorice px-5 py-3
                            text-[12px] font-bold tracking-tight text-isabelline
                            shadow-[0_12px_28px_rgba(35,20,12,0.20)]
                            ring-1 ring-licorice/80
                            transition-all duration-200
                            hover:bg-licorice/95
                            active:scale-[0.985]
                            disabled:opacity-40 disabled:shadow-none
                        "
                    >
                        {settling ? (
                            <>
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                                Recording…
                            </>
                        ) : method === "cash"
                            ? "Confirm Cash"
                            : "Paid on customer's phone"}
                    </button>
                </div>
            </div>
            {/* W7 — Settle bill confirm */}
            <ConfirmModal
                isOpen={settleConfirmOpen}
                title={`Confirm ${formatGHS(total)} cash?`}
                body={`Change due to guest: ${formatGHS(Math.max(0, change))}. This closes the bill and can't be reversed.`}
                confirmLabel="Collect & Close Bill"
                cancelLabel="Go Back"
                isDanger={false}
                loading={settling}
                onConfirm={() => {
                    setSettleConfirmOpen(false);
                    void handleSettle();
                }}
                onClose={() => setSettleConfirmOpen(false)}
            />
        </main>
    );
}
