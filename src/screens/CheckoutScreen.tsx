import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CheckIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { formatGHS, formatGHSString } from "../data/menu";
import { PaystackButton } from "../components/PaystackButton";
import { ReceiptDownloader } from "../components/ReceiptDownloader";
import { db, type DbBill, type DbVenue } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const verifyOnce = async (reference: string, billId: string): Promise<boolean> => {
    try {
        const { data, error } = await db.verifyPayment(reference, billId);
        if (error || !data || (data as { success?: boolean }).success !== true) return false;
        return true;
    } catch {
        return false;
    }
};

/* ────────────────────────── Payment methods ────────────────────────── */

type PaymentMethod = "card" | "momo" | "cash";

type PaymentOption = {
    id: PaymentMethod;
    label: string;
    description: string;
    icon: typeof CreditCardIcon;
};

const PAYMENT_OPTIONS: PaymentOption[] = [
    {
        id: "momo",
        label: "Mobile Money",
        description: "MTN · Telecel · AirtelTigo",
        icon: DevicePhoneMobileIcon,
    },
    {
        id: "card",
        label: "Card",
        description: "Visa, Mastercard, Amex",
        icon: CreditCardIcon,
    },
    {
        id: "cash",
        label: "Cash",
        description: "Your waiter will confirm",
        icon: BanknotesIcon,
    },
];

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    total: number;
    billId?: string;
    venueId?: string;
    sessionToken?: string | null;
    onBack: () => void;
    onPaid: () => void;
};

export function CheckoutScreen({ total, billId, venueId, sessionToken, onBack, onPaid }: Props) {
    const [bill, setBill] = useState<DbBill | null>(null);
    const [venue, setVenue] = useState<DbVenue | null>(null);
    const [tableLabel, setTableLabel] = useState<string | null>(null);
    const [method, setMethod] = useState<PaymentMethod>("momo");
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [needsCheck, setNeedsCheck] = useState(false);
    const [canReCheck, setCanReCheck] = useState(false);
    const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
    const [lastReference, setLastReference] = useState<string | null>(null);
    const [cashRequested, setCashRequested] = useState(false);

    useEffect(() => {
        if (!billId) return;
        let cancelled = false;
        db.billWithTable(billId)
            .then(
                ({ data }) => {
                    if (cancelled) return;
                    if (data) {
                        setBill(data as DbBill);
                        const b = data as DbBill;
                        if (b.status === 'paid' || (Number(b.amount_paid || 0) >= Number(b.total || 0) && Number(b.total || 0) > 0)) {
                            setPaid(true);
                        }
                        if (b.assistance_type === 'cash_settlement') {
                            setCashRequested(true);
                            setMethod('cash');
                        }
                        const t = (data as { tables?: { table_label?: string } | null }).tables;
                        if (t?.table_label) setTableLabel(t.table_label);
                    }
                },
                () => {},
            );
        if (venueId) {
            db.venueById(venueId)
                .then(
                    ({ data }) => {
                        if (!cancelled && data) setVenue(data);
                    },
                    () => {},
                );
        }
        return () => {
            cancelled = true;
        };
    }, [billId, venueId]);

    // ── Live Supabase Realtime Settlement Listeners ──
    useRealtime({
        table: 'bills',
        filter: billId ? `id=eq.${billId}` : undefined,
        onUpdate: (updatedRow: Record<string, unknown>) => {
            const status = String(updatedRow.status || '');
            const amountPaid = Number(updatedRow.amount_paid || 0);
            const billTotal = Number(updatedRow.total || 0);

            if (status === 'paid' || (amountPaid >= billTotal && billTotal > 0)) {
                setPaid(true);
                toast.success("Bill confirmed paid! Thank you.", { icon: "🎉" });
                onPaid?.();
            } else if (updatedRow.assistance_type === 'cash_settlement') {
                setCashRequested(true);
            } else if (updatedRow.assistance_type === null) {
                setCashRequested(false);
            }
        },
    });

    useRealtime({
        table: 'payments',
        filter: billId ? `bill_id=eq.${billId}` : undefined,
        onInsert: () => {
            setPaid(true);
            toast.success("Payment recorded! Thank you.", { icon: "💳" });
            onPaid?.();
        },
    });

    const isPrepay = venue?.payment_model === 'PREPAY' || bill?.payment_model === 'PREPAY';

    // Reconciled bill math: convenience fee is incorporated into displayed subtotal so Subtotal + VAT = Total
    const { subtotal, serviceCharge, vat, billTotal, payAmount, totalPaid } = useMemo(() => {
        if (bill) {
            const fee = Number((bill as { convenience_fee?: number })?.convenience_fee || 0);
            const remainingAmount = Math.max(0, Math.round((bill.total - bill.amount_paid) * 100) / 100);
            const displayedSubtotal = Math.round(((bill.subtotal || 0) + fee) * 100) / 100;
            return {
                subtotal: displayedSubtotal,
                serviceCharge: bill.service_charge || 0,
                vat: bill.vat || 0,
                billTotal: bill.total,
                payAmount: remainingAmount,
                totalPaid: bill.total,
            };
        }
        // Fallback while the bill loads
        const sub = total / 1.225;
        return {
            subtotal: Math.round(sub * 100) / 100,
            serviceCharge: Math.round(sub * 0.1 * 100) / 100,
            vat: Math.round(sub * 0.125 * 100) / 100,
            billTotal: total,
            payAmount: total,
            totalPaid: total,
        };
    }, [bill, total]);

    // Cash never charges the customer directly — a waiter confirms the payment on their
    // own device. The customer-side CTA is a request for the waiter.
    const handleCashRequest = async () => {
        if (!billId) {
            toast.error("Something went wrong — please try again.");
            return;
        }
        setPaying(true);
        try {
            const token = sessionToken || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nightos:current_session_token') : null);
            const { error } = await db.requestWaiterAssistance(billId, 'cash_settlement', token);
            if (error) throw error;
            setCashRequested(true);
            toast.success("Your waiter will come over to confirm your cash payment.");
        } catch (err) {
            console.error('[CheckoutScreen] requestWaiterAssistance error:', err);
            toast.error("Could not notify waiter. Please try again.");
        } finally {
            setPaying(false);
        }
    };

    const handleCancelCashRequest = async () => {
        if (!billId) return;
        try {
            await db.clearWaiterAssistance(billId);
            setCashRequested(false);
            toast("Cash request cancelled. You can select another payment option.", { icon: "ℹ️" });
        } catch {
            setCashRequested(false);
        }
    };

    const handlePaystackSuccess = async (reference: string) => {
        if (!billId) return;
        setLastReference(reference);
        setVerifying(true);
        setPaying(true);

        for (const delay of [2000, 4000]) {
            await sleep(delay);
            if (await verifyOnce(reference, billId)) {
                setVerifying(false);
                setPaying(false);
                setPaid(true);
                window.setTimeout(onPaid, 1800);
                return;
            }
        }

        setVerifying(false);
        setPaying(false);
        setNeedsCheck(true);
        setCanReCheck(false);
        setCountdownLeft(8);
    };

    const handleCheckAgain = async () => {
        if (!lastReference || !billId) return;
        setPaying(true);
        for (const delay of [0, 1500, 3000]) {
            if (delay) await sleep(delay);
            if (await verifyOnce(lastReference, billId)) {
                setPaying(false);
                setNeedsCheck(false);
                setPaid(true);
                window.setTimeout(onPaid, 1800);
                return;
            }
        }
        setPaying(false);
        toast.error("We still can't see the payment yet. Keep your Paystack receipt — we'll reconcile it.");
        setCanReCheck(false);
        setCountdownLeft(8);
        setNeedsCheck(true);
    };

    useEffect(() => {
        if (!needsCheck || countdownLeft === null) return;
        if (countdownLeft <= 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCanReCheck(true);
            setCountdownLeft(null);
            return;
        }
        const t = window.setTimeout(() => setCountdownLeft((c) => (c === null ? null : c - 1)), 1000);
        return () => window.clearTimeout(t);
    }, [needsCheck, countdownLeft]);

    // ── Success state ──
    if (paid && billId) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col items-center justify-center px-5 py-12">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                >
                    <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-khaki blur-[80px] opacity-25" />
                    <div className="absolute bottom-0 -left-20 h-64 w-64 rounded-full bg-light-blue blur-[80px] opacity-20" />
                </div>
                <div className="relative z-10 w-full max-w-sm animate-velvet-scale-in">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative">
                            <div className="absolute inset-0 animate-ping rounded-full bg-khaki/30" />
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-licorice shadow-[0_16px_40px_rgba(35,20,12,0.25)]">
                                <CheckCircleIcon className="h-10 w-10 text-khaki" strokeWidth={2} />
                            </div>
                        </div>
                        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-khaki">
                            Payment Confirmed
                        </p>
                        <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-[-0.04em] text-licorice">
                            Thank you
                        </h1>
                        <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                            Your payment has been received and your table bill is settled.
                        </p>
                        
                        <div className="mt-5 w-full rounded-2xl bg-white p-4 text-left shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau mb-2 text-center">Order Summary</p>
                            <div className="flex justify-between items-center py-2 border-b border-isabelline">
                                <span className="text-[12px] font-semibold text-feldgrau">Reference</span>
                                <span className="font-mono text-[13px] font-bold text-licorice tracking-wider">{billId.slice(0, 8).toUpperCase()}</span>
                            </div>
                            {tableLabel && (
                                <div className="flex justify-between items-center py-2 border-b border-isabelline">
                                    <span className="text-[12px] font-semibold text-feldgrau">Table</span>
                                    <span className="text-[13px] font-bold text-licorice">Table {tableLabel}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-isabelline">
                                <span className="text-[12px] font-semibold text-feldgrau">Payment Method</span>
                                <span className="text-[13px] font-bold capitalize text-licorice">{method === 'momo' ? 'Mobile Money' : method === 'card' ? 'Card' : 'Cash'}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-[13px] font-bold text-licorice">Total Settled</span>
                                <span className="font-mono text-[16px] font-black text-licorice">{formatGHS(totalPaid || billTotal || total)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <ReceiptDownloader fileName={`Receipt-${billId.slice(0, 8)}.png`}>
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold tracking-tight text-khaki shadow-[0_12px_32px_rgba(35,20,12,0.2)] transition-all hover:bg-licorice/95 active:scale-95"
                            >
                                <span>📥 Download Receipt (PNG)</span>
                            </button>
                        </ReceiptDownloader>

                        <button
                            type="button"
                            onClick={onBack}
                            className="w-full flex items-center justify-center gap-2 rounded-full border border-licorice/15 bg-white px-5 py-3 text-[13px] font-bold tracking-tight text-licorice shadow-sm transition-all hover:bg-isabelline active:scale-95"
                        >
                            Return to Menu
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // ── Main checkout view ──
    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
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
                            Checkout
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            {tableLabel ? `Table ${tableLabel}` : venue?.name || "Bysen"}
                        </span>
                    </div>

                    <div className="w-9" />
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
                {/* ── Title Section ── */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                        Pay Your Bill
                    </p>
                    <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                        Your bill
                        <br />
                        <span className="italic font-serif font-bold text-khaki">
                            at a glance
                        </span>
                    </h1>
                </div>

                {/* ── Bill Summary Card ── */}
                <div className="mb-5 overflow-hidden rounded-xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-isabelline px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            Bill Summary
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                            {venue?.name || "Velvet Lounge"}
                        </span>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2 px-4 py-3">
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="tracking-tight text-feldgrau">Subtotal</span>
                            <span className="font-mono font-bold tabular-nums text-licorice">
                                {formatGHS(subtotal)}
                            </span>
                        </div>
                        {serviceCharge > 0 && (
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="tracking-tight text-feldgrau">
                                    Service Charge <span className="text-feldgrau/60">({venue?.service_charge_pct ?? 10}%)</span>
                                </span>
                                <span className="font-mono font-bold tabular-nums text-licorice">
                                    {formatGHS(serviceCharge)}
                                </span>
                            </div>
                        )}
                        {vat > 0 && (
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="tracking-tight text-feldgrau">
                                    VAT <span className="text-feldgrau/60">({venue?.vat_pct ?? 12.5}%)</span>
                                </span>
                                <span className="font-mono font-bold tabular-nums text-licorice">
                                    {formatGHS(vat)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Bill Total */}
                    <div className="flex items-end justify-between border-t border-isabelline px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            {bill && bill.amount_paid > 0 ? "Amount Due" : "Bill Total"}
                        </span>
                        <span className="font-mono text-[18px] font-bold tabular-nums text-licorice">
                            {formatGHS(bill ? billTotal : total)}
                        </span>
                    </div>
                </div>

                {/* ── Payment Method ── */}
                <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    <span className="text-[12px] font-bold tracking-tight text-licorice">
                        Payment method
                    </span>

                    <div className="mt-3 flex flex-col gap-2">
                        {PAYMENT_OPTIONS.map((option) => {
                            const isActive = method === option.id;
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setMethod(option.id)}
                                    className={`
                                        flex items-center gap-3 rounded-xl px-3 py-3
                                        text-left transition-all duration-150 ease-out
                                        active:scale-[0.99]
                                        ${isActive
                                            ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.15)]"
                                            : "bg-isabelline text-licorice ring-1 ring-licorice/8 hover:ring-licorice/15"
                                        }
                                    `}
                                >
                                    <div
                                        className={`
                                            flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                            ${isActive ? "bg-isabelline/15" : "bg-white"}
                                        `}
                                    >
                                        <Icon
                                            className={`h-4 w-4 ${isActive ? "text-khaki" : "text-licorice"}`}
                                            strokeWidth={2}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-bold tracking-tight">
                                            {option.label}
                                        </p>
                                        <p
                                            className={`text-[10.5px] tracking-tight ${isActive ? "text-isabelline/60" : "text-feldgrau"}`}
                                        >
                                            {option.description}
                                        </p>
                                    </div>
                                    <div
                                        className={`
                                            flex h-5 w-5 shrink-0 items-center justify-center
                                            rounded-full transition-all
                                            ${isActive
                                                ? "bg-khaki text-licorice"
                                                : "bg-white text-transparent ring-1 ring-licorice/15"
                                            }
                                        `}
                                    >
                                        <CheckIcon className="h-3 w-3" strokeWidth={3} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Grand Total Preview ── */}
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                You Pay
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium tracking-tight text-isabelline/50">
                                {isPrepay
                                    ? "Prepay your bill — pay before ordering"
                                    : "Pay at the table when you're done"}
                            </p>
                        </div>
                        <span className="font-mono text-[22px] font-black tabular-nums text-isabelline">
                            {formatGHS(payAmount)}
                        </span>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                STICKY BOTTOM CTA — Pay
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                {verifying ? (
                    <button
                        type="button"
                        disabled
                        className="
                            group flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            disabled:opacity-90
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Confirming
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                Confirming your payment with Paystack…
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </span>
                    </button>
                ) : needsCheck ? (
                    <button
                        type="button"
                        onClick={handleCheckAgain}
                        disabled={!canReCheck || paying}
                        className="
                            group flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            transition-all duration-200 ease-out
                            active:scale-[0.985]
                            disabled:opacity-90
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                {paying ? "Checking…" : "Payment pending"}
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                {paying
                                    ? "Checking with Paystack…"
                                    : canReCheck
                                        ? "Check again"
                                        : `Recheck available in ${countdownLeft ?? 8}s`}
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                            {paying ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            ) : (
                                <CheckIcon className="h-4 w-4" strokeWidth={3} />
                            )}
                        </span>
                    </button>
                ) : billId && venueId && (method === 'card' || method === 'momo') ? (
                    <PaystackButton
                        amount={payAmount}
                        billId={billId}
                        venueId={venueId}
                        channels={method === 'momo' ? ['mobile_money'] : ['card']}
                        onSuccess={handlePaystackSuccess}
                        onClose={() => setPaying(false)}
                        className="
                            group flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            transition-all duration-200 ease-out
                            hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)]
                            active:scale-[0.985]
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Pay with {PAYMENT_OPTIONS.find((p) => p.id === method)?.label}
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                Pay {formatGHS(payAmount)}
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                            <CheckIcon className="h-4 w-4" strokeWidth={3} />
                        </span>
                    </PaystackButton>
                ) : method === 'cash' ? (
                    <div className="flex w-full max-w-md md:max-w-2xl flex-col items-center gap-2">
                        {cashRequested ? (
                            <>
                                <div className="flex w-full items-center justify-between gap-3 rounded-full bg-licorice px-6 py-4 shadow-[0_20px_50px_rgba(35,20,12,0.25)] ring-2 ring-khaki/40">
                                    <span className="flex flex-col items-start leading-tight">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                            <span className="h-2 w-2 rounded-full bg-khaki animate-ping" />
                                            Waiter Notified
                                        </span>
                                        <span className="text-[14px] font-bold tracking-tight text-isabelline">
                                            Your waiter is on their way with the bill
                                        </span>
                                    </span>
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-khaki text-licorice">
                                        <BanknotesIcon className="h-4 w-4 animate-bounce" strokeWidth={2.5} />
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelCashRequest}
                                    className="text-[11px] font-bold text-licorice/70 hover:text-licorice underline underline-offset-4 py-1 transition-colors"
                                >
                                    Cancel & choose Mobile Money or Card
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCashRequest}
                                disabled={paying}
                                className="
                                    group flex w-full items-center justify-between
                                    gap-3 rounded-full bg-licorice px-6 py-4
                                    shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                                    ring-1 ring-licorice/80
                                    transition-all duration-200 ease-out
                                    hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)]
                                    active:scale-[0.985]
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                                "
                            >
                                <span className="flex flex-col items-start leading-tight">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                        Pay with cash
                                    </span>
                                    <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                        Notify waiter for {formatGHSString(payAmount)}
                                    </span>
                                </span>
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                                    <BanknotesIcon className="h-4 w-4" strokeWidth={2} />
                                </span>
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="
                            group flex w-full max-w-md md:max-w-2xl items-center justify-between
                            gap-3 rounded-full bg-licorice px-6 py-4
                            shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                            ring-1 ring-licorice/80
                            disabled:opacity-70
                        "
                    >
                        <span className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Unavailable
                            </span>
                            <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                Please scan your table's QR code to pay
                            </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                            <CheckIcon className="h-4 w-4" strokeWidth={3} />
                        </span>
                    </button>
                )}
            </div>
        </main>
    );
}
