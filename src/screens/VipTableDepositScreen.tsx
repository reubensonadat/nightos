import { useState } from "react";
import {
    SparklesIcon,
    ShieldCheckIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../data/menu";
import { PaystackButton } from "../components/PaystackButton";
import { db, type DbTable } from "../lib/api";

type Props = {
    venueId: string;
    venueName?: string | null;
    table: DbTable;
    billId: string;
    sessionToken?: string | null;
    tablePin?: string | null;
    minDeposit: number;
    onDepositPaid: () => void;
};

export function VipTableDepositScreen({
    venueId,
    venueName,
    table,
    billId,
    tablePin,
    minDeposit,
    onDepositPaid,
}: Props) {
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState<"both" | "momo" | "card">("both");

    const handlePaystackSuccess = async (reference: string) => {
        setPaying(true);
        try {
            // 1. Record deposit payment and update bill deposit credit
            await db.recordDepositPayment({
                billId,
                venueId,
                amount: minDeposit,
                reference,
                method: selectedChannel === "momo" ? "mobile_money" : selectedChannel === "card" ? "card" : "paystack",
            });

            // 2. Automatically save PIN if present so guest is unlocked
            if (tablePin) {
                try {
                    localStorage.setItem(`nightos:table_pin:${billId}`, tablePin);
                } catch {
                    /* ignore */
                }
            }

            setPaid(true);
            toast.success(`🎉 VIP Table Unlocked! ${formatGHS(minDeposit)} credit is ready to spend.`);
            setTimeout(() => {
                onDepositPaid();
            }, 1200);
        } catch (err) {
            console.error("[VipTableDepositScreen] Payment recording error:", err);
            // Fallback: try setting the bill deposit directly
            try {
                await db.setBillDeposit(billId, minDeposit, true);
                setPaid(true);
                toast.success(`🎉 VIP Table Unlocked! Credit added.`);
                setTimeout(() => {
                    onDepositPaid();
                }, 1200);
            } catch {
                toast.error("Could not register deposit. Please show your confirmation reference to a waiter.");
                setPaying(false);
            }
        }
    };

    if (paid) {
        return (
            <main className="min-h-svh bg-licorice text-isabelline flex flex-col items-center justify-center px-6 py-12 text-center antialiased">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40">
                    <CheckCircleIcon className="h-12 w-12" />
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                    Deposit Confirmed
                </span>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-isabelline">
                    Table Unlocked!
                </h1>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-isabelline/70">
                    Your upfront deposit of <span className="font-mono font-bold text-khaki">{formatGHS(minDeposit)}</span> has been credited to {table.table_label}. You can now order drinks, bottles, and food.
                </p>
                <div className="mt-8 flex items-center gap-2 text-xs text-khaki font-medium">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Opening VIP Menu…
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-svh bg-licorice text-isabelline flex flex-col justify-between antialiased selection:bg-khaki selection:text-licorice">
            {/* Top Bar */}
            <header className="relative z-10 border-b border-isabelline/10 px-6 py-4">
                <div className="mx-auto flex max-w-lg items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-khaki/20 text-khaki ring-1 ring-khaki/40 font-serif font-black text-sm">
                            👑
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-khaki">
                                {venueName || "VIP Seating"}
                            </span>
                            <span className="text-xs font-bold text-isabelline/90">
                                {table.table_label} {table.area ? `• ${table.area}` : ""}
                            </span>
                        </div>
                    </div>
                    <span className="rounded-full bg-khaki/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-khaki ring-1 ring-khaki/30">
                        VIP Minimum Spend
                    </span>
                </div>
            </header>

            {/* Central Card */}
            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Ambient glow */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                    <div className="h-72 w-72 rounded-full bg-khaki/15 blur-[100px]" />
                </div>

                <div className="relative z-10 w-full max-w-md text-center">
                    {/* Crown badge */}
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-isabelline/8 px-4 py-1.5 ring-1 ring-isabelline/15">
                        <SparklesIcon className="h-4 w-4 text-khaki" />
                        <span className="text-xs font-bold tracking-wide text-isabelline">
                            Prepaid Table Deposit Required
                        </span>
                    </div>

                    <h1 className="mt-4 text-3xl font-black tracking-tight text-isabelline sm:text-4xl">
                        Unlock {table.table_label}
                    </h1>

                    <p className="mt-2 text-xs leading-relaxed text-isabelline/70 sm:text-sm">
                        To access and start ordering at this VIP table, an upfront minimum spend deposit is required.
                    </p>

                    {/* Deposit Amount Hero Box */}
                    <div className="mt-6 overflow-hidden rounded-3xl border border-khaki/30 bg-gradient-to-b from-isabelline/10 to-isabelline/5 p-6 shadow-2xl backdrop-blur-md">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-khaki">
                            Upfront Table Deposit
                        </span>
                        <div className="mt-1 font-mono text-4xl font-black tracking-tight text-khaki sm:text-5xl">
                            {formatGHS(minDeposit)}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                            <CheckCircleIcon className="h-4 w-4 shrink-0" />
                            <span>100% Consumable Credit</span>
                        </div>
                    </div>

                    {/* How It Works Perks */}
                    <div className="mt-6 space-y-3 text-left">
                        <div className="flex items-start gap-3 rounded-2xl border border-isabelline/8 bg-isabelline/5 p-3.5">
                            <ReceiptPercentIcon className="h-5 w-5 shrink-0 text-khaki mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                <span className="font-bold text-isabelline">100% of deposit converts to credit. </span>
                                <span className="text-isabelline/70">
                                    Every drink, bottle, and dish ordered by your party deducts directly from this balance.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-isabelline/8 bg-isabelline/5 p-3.5">
                            <ShieldCheckIcon className="h-5 w-5 shrink-0 text-khaki mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                <span className="font-bold text-isabelline">Instant table unlock. </span>
                                <span className="text-isabelline/70">
                                    Payments are securely processed via Paystack. As soon as your deposit confirms, ordering opens immediately.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Channel Selector */}
                    <div className="mt-6 grid grid-cols-2 gap-2 text-left">
                        <button
                            type="button"
                            onClick={() => setSelectedChannel("momo")}
                            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                                selectedChannel === "momo"
                                    ? "bg-khaki text-licorice shadow-sm ring-1 ring-khaki"
                                    : "bg-isabelline/5 text-isabelline/80 hover:bg-isabelline/10 ring-1 ring-isabelline/10"
                            }`}
                        >
                            <DevicePhoneMobileIcon className="h-4 w-4 shrink-0" />
                            <span>Mobile Money</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedChannel("card")}
                            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                                selectedChannel === "card"
                                    ? "bg-khaki text-licorice shadow-sm ring-1 ring-khaki"
                                    : "bg-isabelline/5 text-isabelline/80 hover:bg-isabelline/10 ring-1 ring-isabelline/10"
                            }`}
                        >
                            <CreditCardIcon className="h-4 w-4 shrink-0" />
                            <span>Bank Card</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action */}
            <div className="relative z-10 border-t border-isabelline/10 bg-licorice/95 px-6 py-5 backdrop-blur-md">
                <div className="mx-auto max-w-md">
                    {paying ? (
                        <div className="flex w-full items-center justify-center gap-2.5 rounded-full bg-khaki/20 py-4 text-sm font-bold text-khaki ring-1 ring-khaki/40">
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            Confirming Paystack Deposit…
                        </div>
                    ) : (
                        <PaystackButton
                            amount={minDeposit}
                            billId={billId}
                            venueId={venueId}
                            channels={
                                selectedChannel === "momo"
                                    ? ["mobile_money"]
                                    : selectedChannel === "card"
                                    ? ["card"]
                                    : undefined
                            }
                            onSuccess={handlePaystackSuccess}
                            className="
                                group flex w-full items-center justify-between
                                gap-3 rounded-full bg-khaki px-6 py-4
                                text-licorice shadow-[0_10px_35px_rgba(202,168,98,0.25)]
                                transition-all duration-200 ease-out
                                hover:bg-khaki/90 active:scale-[0.985] cursor-pointer
                            "
                        >
                            <span className="flex flex-col items-start leading-tight text-left">
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-licorice/70">
                                    Pay Deposit with Paystack
                                </span>
                                <span className="text-[15px] font-black tracking-tight text-licorice">
                                    Pay {formatGHS(minDeposit)} & Unlock Table
                                </span>
                            </span>
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-khaki">
                                ➔
                            </span>
                        </PaystackButton>
                    )}
                    <p className="mt-3 text-center text-[11px] text-isabelline/50">
                        Secured by Paystack · GH₵ 2,000 becomes full credit
                    </p>
                </div>
            </div>
        </main>
    );
}
