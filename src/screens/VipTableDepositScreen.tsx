import { useEffect, useState } from "react";
import {
    CreditCardIcon,
    DevicePhoneMobileIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    KeyIcon,
} from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { formatGHS } from "../data/menu";
import { PaystackButton } from "../components/PaystackButton";
import { db, type DbTable } from "../lib/api";
import heroImage from "../assets/hero-image.jpg";

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
    table,
    billId,
    tablePin,
    minDeposit,
    onDepositPaid,
}: Props) {
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState<"both" | "momo" | "card">("both");
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [enteredCode, setEnteredCode] = useState("");
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const [split, setSplit] = useState<{
        subaccount?: string | null;
        transaction_charge_pesewas?: number;
        debt_clawback?: number;
    } | null>(null);

    // Pre-fetch the Paystack subaccount split for this deposit
    useEffect(() => {
        if (!venueId || minDeposit <= 0) return;
        let cancelled = false;
        db.getDynamicPaystackSplit(venueId, minDeposit).then(({ data }) => {
            if (!cancelled && data) setSplit(data);
        });
        return () => {
            cancelled = true;
        };
    }, [venueId, minDeposit]);

    const splitChargePesewas =
        split?.subaccount && Number(split.transaction_charge_pesewas || 0) > 0
            ? Math.min(Number(split.transaction_charge_pesewas), Math.round(minDeposit * 0.9 * 100))
            : 0;

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

            // 1b. Settle any fee-debt clawback bundled into this deposit charge
            const clawback = Number(split?.debt_clawback || 0);
            if (clawback > 0) {
                db.reconcileVenueFeeDebt(venueId, null, clawback).catch(() => undefined);
            }

            // 2. Automatically save PIN if present so guest is unlocked
            if (tablePin) {
                try {
                    localStorage.setItem(`nightos:table_pin:${billId}`, tablePin);
                } catch {
                    /* ignore */
                }
            }

            setPaid(true);
            toast.success(`🎉 Table Unlocked! ${formatGHS(minDeposit)} credit is ready to spend.`);
            setTimeout(() => {
                onDepositPaid();
            }, 1200);
        } catch (err) {
            console.error("[VipTableDepositScreen] Payment recording error:", err);
            // Fallback: try setting the bill deposit directly
            try {
                await db.setBillDeposit(billId, minDeposit, true);
                setPaid(true);
                toast.success(`🎉 Table Unlocked! Credit added.`);
                setTimeout(() => {
                    onDepositPaid();
                }, 1200);
            } catch {
                toast.error("Could not register deposit. Please show your confirmation reference to a waiter.");
                setPaying(false);
            }
        }
    };

    const handleVerifyCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = enteredCode.trim();
        if (!code) return;

        setVerifyingCode(true);
        setCodeError(null);

        try {
            let validPin = tablePin;
            if (!validPin) {
                const { data: billData } = await db.billById(billId);
                validPin = billData?.table_pin ?? null;
            }

            if (validPin && code === validPin.trim()) {
                try {
                    localStorage.setItem(`nightos:table_pin:${billId}`, validPin);
                } catch {
                    /* ignore */
                }
                toast.success("Table unlocked!");
                onDepositPaid();
            } else {
                // Deposit recovery: if this table already carries a deposit-
                // paid bill from the last 2 hours, the guest's original table
                // code still lands them back into that tab — no re-payment.
                const { data: depBill } = await db.recentDepositBillForTable(table.id);
                const depUpdated = depBill?.updated_at ? new Date(depBill.updated_at).getTime() : 0;
                const withinTwoHours = Date.now() - depUpdated < 2 * 60 * 60 * 1000;
                if (
                    depBill &&
                    depBill.id !== billId &&
                    depBill.table_pin &&
                    withinTwoHours &&
                    code === depBill.table_pin.trim()
                ) {
                    try {
                        localStorage.setItem(`nightos:table_pin:${depBill.id}`, depBill.table_pin);
                    } catch {
                        /* ignore */
                    }
                    toast.success("Welcome back — your deposit tab was found!");
                    onDepositPaid();
                    return;
                }
                setCodeError("Incorrect code. Please ask your table host or waiter.");
            }
        } catch (err) {
            console.error("Code verification error:", err);
            setCodeError("Could not verify code. Please try again.");
        } finally {
            setVerifyingCode(false);
        }
    };

    if (paid) {
        return (
            <main className="relative min-h-svh bg-[#0E0A08] text-isabelline flex flex-col items-center justify-center px-6 py-12 text-center antialiased overflow-hidden">
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center opacity-45 scale-105"
                    style={{ backgroundImage: `url(${heroImage})` }}
                />
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0E0A08]/70 via-[#0E0A08]/55 to-[#0E0A08]/85" />

                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                        <CheckCircleIcon className="h-12 w-12" />
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                        Deposit Confirmed
                    </span>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                        Table Unlocked!
                    </h1>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-isabelline/70">
                        Your upfront deposit of <span className="font-mono font-bold text-khaki">{formatGHS(minDeposit)}</span> has been credited to {table.table_label}. You can now order drinks, bottles, and food.
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-xs text-khaki font-medium">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        Opening Menu…
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="relative min-h-svh bg-[#0E0A08] text-isabelline flex flex-col justify-between antialiased overflow-hidden selection:bg-khaki selection:text-licorice">
            {/* Atmospheric Hero Image Background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center opacity-55 scale-105"
                style={{ backgroundImage: `url(${heroImage})` }}
            />
            {/* Clean Dark Neutral Gradient Overlay with tuned mid-section tint */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0E0A08]/70 via-[#0E0A08]/60 to-[#0E0A08]/85 pointer-events-none" />

            {/* Central Card */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10">
                <div className="w-full max-w-md text-center">
                    {/* Clean Header Title */}
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                        Unlock {table.table_label}
                    </h1>

                    <p className="mt-2.5 text-xs leading-relaxed text-isabelline/75 sm:text-sm max-w-sm mx-auto">
                        To access ordering at this exclusive table, an upfront consumable credit is required.
                    </p>

                    {/* Deposit Amount Hero Box */}
                    <div className="mt-6 overflow-hidden rounded-3xl border border-khaki/20 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/10">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-khaki/90">
                            Upfront Table Deposit
                        </span>
                        <div className="mt-2 font-mono text-4xl font-black tracking-tight text-khaki sm:text-5xl drop-shadow-[0_2px_10px_rgba(208,186,152,0.25)]">
                            {formatGHS(minDeposit)}
                        </div>
                    </div>

                    {/* Payment Method Selector Section */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-white tracking-tight">
                            Select Payment Method
                        </h3>
                        <div className="mt-3 grid grid-cols-2 gap-2.5 max-w-sm mx-auto">
                            <button
                                type="button"
                                onClick={() => setSelectedChannel(selectedChannel === "momo" ? "both" : "momo")}
                                className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-xs font-bold transition-all cursor-pointer ${selectedChannel === "momo"
                                        ? "bg-khaki text-licorice shadow-[0_4px_16px_rgba(208,186,152,0.35)] ring-2 ring-khaki"
                                        : "bg-white/[0.06] text-isabelline hover:bg-white/[0.1] border border-white/10"
                                    }`}
                            >
                                <DevicePhoneMobileIcon className="h-4 w-4 shrink-0" />
                                <span>Mobile Money</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedChannel(selectedChannel === "card" ? "both" : "card")}
                                className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-xs font-bold transition-all cursor-pointer ${selectedChannel === "card"
                                        ? "bg-khaki text-licorice shadow-[0_4px_16px_rgba(208,186,152,0.35)] ring-2 ring-khaki"
                                        : "bg-white/[0.06] text-isabelline hover:bg-white/[0.1] border border-white/10"
                                    }`}
                            >
                                <CreditCardIcon className="h-4 w-4 shrink-0" />
                                <span>Bank Card</span>
                            </button>
                        </div>

                        {/* Paid already? Enter Code Section */}
                        <div className="mt-5 max-w-sm mx-auto">
                            {!showCodeInput ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCodeInput(true)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-khaki/90 hover:text-khaki transition-colors cursor-pointer py-1"
                                >
                                    <KeyIcon className="h-3.5 w-3.5" />
                                    <span>Paid already? Enter code</span>
                                </button>
                            ) : (
                                <form onSubmit={handleVerifyCode} className="mt-2 space-y-2.5 animate-fade-in">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            pattern="[0-9]*"
                                            placeholder="Enter Code"
                                            value={enteredCode}
                                            onChange={(e) => {
                                                setEnteredCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                                                setCodeError(null);
                                            }}
                                            className="flex-1 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center font-mono text-sm font-bold tracking-widest text-white placeholder:text-isabelline/30 placeholder:tracking-normal focus:border-khaki focus:outline-none focus:ring-1 focus:ring-khaki"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            disabled={verifyingCode || !enteredCode.trim()}
                                            className="rounded-2xl bg-khaki px-4 py-3 text-xs font-bold text-licorice transition-all hover:bg-khaki/90 active:scale-95 disabled:opacity-50 cursor-pointer"
                                        >
                                            {verifyingCode ? "Verifying…" : "Submit"}
                                        </button>
                                    </div>
                                    {codeError && (
                                        <p className="text-[11px] font-semibold text-rose-400">
                                            {codeError}
                                        </p>
                                    )}
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action */}
            <div className="relative z-10 border-t border-white/10 bg-[#0E0A08]/90 px-6 py-5 backdrop-blur-xl">
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
                            subaccount={split?.subaccount ?? null}
                            transactionCharge={splitChargePesewas || null}
                            channels={
                                selectedChannel === "momo"
                                    ? ["mobile_money"]
                                    : selectedChannel === "card"
                                        ? ["card"]
                                        : undefined
                            }
                            onSuccess={handlePaystackSuccess}
                            className="
                                flex w-full items-center justify-center
                                rounded-full bg-khaki px-6 py-4
                                text-licorice shadow-md shadow-black/30
                                transition-all duration-200 ease-out
                                hover:bg-khaki/90 active:scale-[0.985] cursor-pointer
                            "
                        >
                            <span className="font-display text-[15px] sm:text-base font-black tracking-wide uppercase text-licorice text-center">
                                Unlock {table.table_label}
                            </span>
                        </PaystackButton>
                    )}
                    <p className="mt-3 text-center text-[11px] text-isabelline/60 font-medium">
                        Secured by Paystack
                    </p>
                </div>
            </div>
        </main>
    );
}
