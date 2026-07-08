import { useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    BanknotesIcon,
    BuildingLibraryIcon,
    CheckIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    WalletIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";

/* ────────────────────────── Payment methods ────────────────────────── */

type PaymentMethod = "card" | "momo" | "bank" | "wallet" | "cash";

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
        id: "bank",
        label: "Bank Transfer",
        description: "Direct transfer to Velvet Lounge",
        icon: BuildingLibraryIcon,
    },
    {
        id: "wallet",
        label: "Digital Wallet",
        description: "Apple Pay · Google Pay · Hubtel",
        icon: WalletIcon,
    },
    {
        id: "cash",
        label: "Cash",
        description: "Pay your server directly",
        icon: BanknotesIcon,
    },
];

/* ────────────────────────── Tip presets ────────────────────────── */

const TIP_PRESETS = [
    { percent: 0, label: "No thanks" },
    { percent: 10, label: "10%" },
    { percent: 15, label: "15%" },
    { percent: 20, label: "20%" },
] as const;

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    /** Bill total before tip (includes service + VAT). */
    total: number;
    onBack: () => void;
    onPaid: () => void;
};

export function CheckoutScreen({ total, onBack, onPaid }: Props) {
    const [tipPercent, setTipPercent] = useState<number>(15);
    const [method, setMethod] = useState<PaymentMethod>("momo");
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);

    // Reverse-engineer the breakdown for display
    // total = subtotal * (1 + 0.10 + 0.125) = subtotal * 1.225
    const { subtotal, serviceCharge, vat } = useMemo(() => {
        const sub = total / 1.225;
        const service = sub * 0.1;
        const tax = sub * 0.125;
        return {
            subtotal: Math.round(sub * 100) / 100,
            serviceCharge: Math.round(service * 100) / 100,
            vat: Math.round(tax * 100) / 100,
        };
    }, [total]);

    const tipAmount = useMemo(
        () => Math.round(total * (tipPercent / 100) * 100) / 100,
        [total, tipPercent]
    );
    const grandTotal = total + tipAmount;

    const handlePay = () => {
        setPaying(true);
        window.setTimeout(() => {
            setPaying(false);
            setPaid(true);
            window.setTimeout(() => {
                onPaid();
            }, 1800);
        }, 1500);
    };

    // ── Success state ──
    if (paid) {
        return (
            <main className="relative min-h-svh w-full overflow-hidden bg-isabelline font-sans text-licorice antialiased flex items-center justify-center px-5">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-khaki blur-[80px] opacity-25" />
                    <div className="absolute bottom-0 -left-20 h-64 w-64 rounded-full bg-light-blue blur-[80px] opacity-20" />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center animate-velvet-scale-in">
                    <div className="relative">
                        <div className="absolute inset-0 animate-ping rounded-full bg-khaki/30" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-licorice shadow-[0_16px_40px_rgba(35,20,12,0.25)]">
                            <CheckCircleIcon className="h-10 w-10 text-khaki" strokeWidth={2} />
                        </div>
                    </div>
                    <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-feldgrau">
                        Payment Received
                    </p>
                    <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-[-0.04em] text-licorice">
                        Thank you
                        <br />
                        <span className="italic font-serif font-bold text-khaki">
                            for dining with us
                        </span>
                    </h1>
                    <p className="mx-auto mt-3 max-w-[300px] text-[13px] leading-[1.55] tracking-tight text-feldgrau">
                        {formatGHS(grandTotal)} paid via{" "}
                        {PAYMENT_OPTIONS.find((p) => p.id === method)?.label}.
                        Your receipt has been sent.
                    </p>
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
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3 relative">
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                        >
                            <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                    </div>

                    <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] bottom-3 flex items-center justify-center pointer-events-none">
                        <span className="text-[18px] font-bold tracking-tight text-licorice pointer-events-auto">
                            Checkout
                        </span>
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
                {/* ── Title Section ── */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                        Settle Up
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
                <div className="mb-5 overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-isabelline px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            Bill Summary
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                            Velvet Lounge
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
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="tracking-tight text-feldgrau">
                                Service charge{" "}
                                <span className="text-feldgrau/60">(10%)</span>
                            </span>
                            <span className="font-mono font-bold tabular-nums text-licorice">
                                {formatGHS(serviceCharge)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="tracking-tight text-feldgrau">
                                VAT <span className="text-feldgrau/60">(12.5%)</span>
                            </span>
                            <span className="font-mono font-bold tabular-nums text-licorice">
                                {formatGHS(vat)}
                            </span>
                        </div>
                    </div>

                    {/* Bill Total */}
                    <div className="flex items-end justify-between border-t border-isabelline px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            Bill Total
                        </span>
                        <span className="font-mono text-[18px] font-bold tabular-nums text-licorice">
                            {formatGHS(total)}
                        </span>
                    </div>
                </div>

                {/* ── Tip Section ── */}
                <div className="mb-5 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[12px] font-bold tracking-tight text-licorice">
                                Add a tip
                            </span>
                            <p className="mt-0.5 text-[10.5px] tracking-tight text-feldgrau">
                                100% goes to your server
                            </p>
                        </div>
                        {tipPercent > 0 && (
                            <span className="font-mono text-[13px] font-bold tabular-nums text-khaki">
                                +{formatGHS(tipAmount)}
                            </span>
                        )}
                    </div>

                    {/* Tip presets */}
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {TIP_PRESETS.map((preset) => {
                            const isActive = tipPercent === preset.percent;
                            return (
                                <button
                                    key={preset.percent}
                                    type="button"
                                    onClick={() => setTipPercent(preset.percent)}
                                    className={`
                                        flex flex-col items-center justify-center
                                        rounded-xl py-2.5
                                        text-[12px] font-bold tracking-tight
                                        transition-all duration-150 ease-out
                                        active:scale-95
                                        ${isActive
                                            ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                            : "bg-isabelline text-feldgrau ring-1 ring-licorice/8 hover:text-licorice hover:ring-licorice/15"
                                        }
                                    `}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
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
                                Grand Total
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium tracking-tight text-isabelline/50">
                                {tipPercent > 0
                                    ? `Includes ${tipPercent}% tip`
                                    : "No tip added"}
                            </p>
                        </div>
                        <span className="font-mono text-[22px] font-black tabular-nums text-isabelline">
                            {formatGHS(grandTotal)}
                        </span>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                STICKY BOTTOM CTA — Pay
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                <button
                    type="button"
                    onClick={handlePay}
                    disabled={paying}
                    className="
                        group flex w-full max-w-md md:max-w-2xl items-center justify-between
                        gap-3 rounded-full bg-licorice px-6 py-4
                        shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                        ring-1 ring-licorice/80
                        transition-all duration-200 ease-out
                        hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)]
                        active:scale-[0.985]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                        disabled:opacity-90
                    "
                >
                    <span className="flex flex-col items-start leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            {paying ? "Processing…" : "Confirm"}
                        </span>
                        <span className="text-[15px] font-bold tracking-tight text-isabelline">
                            {paying
                                ? `Paying via ${PAYMENT_OPTIONS.find((p) => p.id === method)?.label}`
                                : `Pay ${formatGHS(grandTotal)}`}
                        </span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice">
                        {paying ? (
                            <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeOpacity="0.25"
                                />
                                <path
                                    d="M22 12a10 10 0 0 1-10 10"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </svg>
                        ) : (
                            <CheckIcon className="h-4 w-4" strokeWidth={3} />
                        )}
                    </span>
                </button>
            </div>
        </main>
    );
}
