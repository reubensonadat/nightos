import { useState } from "react";
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CheckCircleIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    PrinterIcon,
    ShareIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import type { Table } from "./TablesDashboard";

/* ────────────────────────── Mock bill data ────────────────────────── */

type BillItem = {
    name: string;
    quantity: number;
    price: number;
};

const MOCK_BILL: BillItem[] = [
    { name: "Velvet Old Fashioned", quantity: 2, price: 65 },
    { name: "Lamb Suya Skewers", quantity: 1, price: 45 },
    { name: "Hibiscus Spritz", quantity: 1, price: 35 },
    { name: "Cocoa Espresso Martini", quantity: 1, price: 55 },
];

const VAT_RATE = 0.05; // 5% VAT
const SERVICE_RATE = 0.10; // 10% service charge

/* ────────────────────────── Payment methods ────────────────────────── */

type PaymentMethod = "cash" | "card" | "momo";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof BanknotesIcon }[] = [
    { id: "cash", label: "Cash", icon: BanknotesIcon },
    { id: "card", label: "Card", icon: CreditCardIcon },
    { id: "momo", label: "MoMo", icon: DevicePhoneMobileIcon },
];

/* ────────────────────────── Quick cash amounts ────────────────────────── */

const QUICK_CASH = [50, 100, 200, 500];

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    table: Table;
    onBack: () => void;
    onSettled: () => void;
};

export function InvoiceSettlementScreen({ table, onBack, onSettled }: Props) {
    const [method, setMethod] = useState<PaymentMethod>("cash");
    const [cashReceived, setCashReceived] = useState<string>("");
    const [settled, setSettled] = useState(false);
    const [invoiceNo] = useState(() => `VL-${Date.now().toString(36).slice(-6).toUpperCase()}`);

    // Calculate bill
    const subtotal = MOCK_BILL.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const vat = subtotal * VAT_RATE;
    const service = subtotal * SERVICE_RATE;
    const total = subtotal + vat + service;

    const received = parseFloat(cashReceived) || 0;
    const change = received - total;
    const canSettle =
        method === "cash"
            ? received >= total
            : true; // Card and MoMo always "succeed" in mock

    const handleSettle = () => {
        if (!canSettle) return;
        setSettled(true);
    };

    /* ── Settled success state ── */
    if (settled) {
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
                                Settled
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                                Invoice
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
                            Invoice generated for Table {String(table.number).padStart(2, "0")}.
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
                            {MOCK_BILL.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between py-1.5 text-[12px]"
                                >
                                    <span className="tracking-tight text-licorice">
                                        {item.quantity}× {item.name}
                                    </span>
                                    <span className="font-mono font-bold tabular-nums text-licorice">
                                        {formatGHS(item.price * item.quantity)}
                                    </span>
                                </div>
                            ))}

                            <div className="mt-3 space-y-1 border-t border-isabelline pt-3 text-[11px]">
                                <div className="flex justify-between text-feldgrau">
                                    <span>Subtotal</span>
                                    <span className="font-mono tabular-nums">{formatGHS(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-feldgrau">
                                    <span>VAT (5%)</span>
                                    <span className="font-mono tabular-nums">{formatGHS(vat)}</span>
                                </div>
                                <div className="flex justify-between text-feldgrau">
                                    <span>Service (10%)</span>
                                    <span className="font-mono tabular-nums">{formatGHS(service)}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-licorice/10 pt-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-licorice">
                                    Total
                                </span>
                                <span className="font-mono text-[18px] font-black tabular-nums text-licorice">
                                    {formatGHS(total)}
                                </span>
                            </div>

                            <div className="mt-3 rounded-lg bg-khaki/12 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-khaki">
                                Paid via {method === "cash" ? "Cash" : method === "card" ? "Card" : "Mobile Money"}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-3 text-[11px] font-bold tracking-tight text-licorice shadow-sm ring-1 ring-licorice/8 transition-all hover:bg-isabelline active:scale-[0.98]"
                        >
                            <PrinterIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Print
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-3 text-[11px] font-bold tracking-tight text-licorice shadow-sm ring-1 ring-licorice/8 transition-all hover:bg-isabelline active:scale-[0.98]"
                        >
                            <ShareIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Share
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onSettled}
                        className="mt-3 w-full rounded-full bg-licorice py-3.5 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985]"
                    >
                        Back to Tables
                    </button>
                </section>
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
                            Invoice & Settlement
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
                                {MOCK_BILL.length} items
                            </p>
                        </div>

                        <div className="mt-3 space-y-1.5">
                            {MOCK_BILL.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-start justify-between gap-2 text-[11.5px]"
                                >
                                    <span className="min-w-0 flex-1 truncate tracking-tight text-isabelline/90">
                                        {item.quantity}× {item.name}
                                    </span>
                                    <span className="shrink-0 font-mono font-bold tabular-nums">
                                        {formatGHS(item.price * item.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-isabelline/10 px-5 py-3">
                        <div className="space-y-0.5 text-[10.5px]">
                            <div className="flex justify-between text-isabelline/60">
                                <span>Subtotal</span>
                                <span className="font-mono tabular-nums">{formatGHS(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-isabelline/60">
                                <span>VAT (5%)</span>
                                <span className="font-mono tabular-nums">{formatGHS(vat)}</span>
                            </div>
                            <div className="flex justify-between text-isabelline/60">
                                <span>Service (10%)</span>
                                <span className="font-mono tabular-nums">{formatGHS(service)}</span>
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
                            Tap, insert, or swipe
                        </p>
                        <p className="mt-1 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                            Use the POS terminal to process the card payment. Confirm here once approved.
                        </p>
                    </div>
                )}

                {/* MoMo-specific UI */}
                {method === "momo" && (
                    <div className="mt-5 animate-velvet-fade rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                        <DevicePhoneMobileIcon className="mx-auto h-8 w-8 text-feldgrau" strokeWidth={1.5} />
                        <p className="mt-2 text-center text-[12px] font-bold tracking-tight text-licorice">
                            Mobile Money
                        </p>
                        <p className="mt-1 text-center text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                            Generate a payment prompt or scan the customer's QR code to collect.
                        </p>
                        <button
                            type="button"
                            className="mt-4 w-full rounded-full bg-isabelline py-2.5 text-[11px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 transition-all hover:bg-khaki/15 active:scale-[0.98]"
                        >
                            Send Payment Prompt
                        </button>
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 bg-isabelline/95 backdrop-blur-xl border-t border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                    <div className="flex min-w-0 flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                            To Settle
                        </span>
                        <span className="font-mono text-[15px] sm:text-[16px] font-black tabular-nums text-licorice">
                            {formatGHS(total)}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleSettle}
                        disabled={!canSettle}
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
                        Settle Bill
                    </button>
                </div>
            </div>
        </main>
    );
}
