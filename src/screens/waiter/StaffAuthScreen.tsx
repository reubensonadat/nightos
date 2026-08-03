import { useState, type FormEvent } from "react";
import {
    ArrowRightIcon,
    ArrowLeftIcon,
    EyeIcon,
    LockClosedIcon,
    UserIcon,
    CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import { useStaff } from "../../hooks/useStaff";
import type { DbStaffSession } from "../../lib/api";

type Props = {
    onSignIn: (session: DbStaffSession) => void;
};

type Step = "phone" | "pin" | "create";

export function StaffAuthScreen({ onSignIn }: Props) {
    const { loading, error: staffError, lookup, setPin, signIn } = useStaff();

    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [pin, setPinValue] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [found, setFound] = useState<{ name: string; venueName: string } | null>(null);

    const goToPhone = () => {
        setStep("phone");
        setFound(null);
        setPinValue("");
        setPinConfirm("");
    };

    const handlePhoneSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) return;
        const result = await lookup(phone.trim());
        if (result) {
            setFound({ name: result.name, venueName: result.venue_name });
            setStep(result.pin_set ? "pin" : "create");
        }
    };

    const handlePinSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (pin.length < 4) return;
        const session = await signIn(phone.trim(), pin);
        if (session) onSignIn(session);
    };

    const handleCreateSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (pin !== pinConfirm) {
            return;
        }
        if (pin.length < 4 || pin.length > 6) {
            return;
        }
        const ok = await setPin(phone.trim(), pin);
        if (ok) {
            const session = await signIn(phone.trim(), pin);
            if (session) onSignIn(session);
        }
    };

    const pinMismatch = pin !== pinConfirm && pinConfirm.length > 0;
    const pinTooShort = pin.length > 0 && pin.length < 4;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col">
            {/* ── Top brand bar ── */}
            <div className="px-5 pt-[max(env(safe-area-inset-top),24px)] pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                        <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                            V
                        </span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            {found?.venueName ?? "Velvet Lounge"}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            Staff Portal · Bysen
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex flex-1 flex-col justify-center px-5 py-8">
                <div className="mx-auto w-full max-w-sm">
                    {step !== "phone" && (
                        <button
                            type="button"
                            onClick={goToPhone}
                            className="mb-6 flex items-center gap-1.5 text-[11px] font-bold tracking-tight text-feldgrau transition-colors hover:text-licorice"
                        >
                            <ArrowLeftIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Change number
                        </button>
                    )}

                    {/* ── Step: phone ── */}
                    {step === "phone" && (
                        <>
                            <div className="mb-8">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                    Staff Sign In
                                </p>
                                <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                    Welcome
                                    <br />
                                    <span className="italic font-serif font-bold text-khaki">
                                        back to the floor
                                    </span>
                                </h1>
                                <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                                    Enter the phone number the manager saved for you. No account needed —
                                    just you and your PIN.
                                </p>
                            </div>

                            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-3">
                                <div>
                                    <label
                                        htmlFor="staff-phone"
                                        className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau"
                                    >
                                        Phone Number
                                    </label>
                                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                        <UserIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                        <input
                                            id="staff-phone"
                                            type="tel"
                                            autoComplete="tel"
                                            autoFocus
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="024 000 0000"
                                            className="flex-1 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {staffError && (
                                    <p className="rounded-lg bg-dark-red/8 px-3 py-2 text-[11px] font-semibold tracking-tight text-dark-red">
                                        {staffError}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || phone.trim().length < 9}
                                    className="
                                        mt-2 flex items-center justify-center gap-2
                                        rounded-full bg-licorice px-5 py-3.5
                                        text-[13px] font-bold tracking-tight text-isabelline
                                        shadow-[0_12px_28px_rgba(35,20,12,0.20)]
                                        ring-1 ring-licorice/80
                                        transition-all duration-200 ease-out
                                        hover:bg-licorice/95 hover:shadow-[0_16px_34px_rgba(35,20,12,0.24)]
                                        active:scale-[0.985]
                                        disabled:opacity-80
                                    "
                                >
                                    {loading ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            </svg>
                                            Checking…
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step: enter PIN ── */}
                    {step === "pin" && (
                        <>
                            <div className="mb-8">
                                <div className="flex items-center gap-2">
                                    <CheckBadgeIcon className="h-4 w-4 text-khaki" strokeWidth={2.25} />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                        {found?.name}
                                    </p>
                                </div>
                                <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                    Enter your
                                    <br />
                                    <span className="italic font-serif font-bold text-khaki">
                                        personal PIN
                                    </span>
                                </h1>
                                <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                                    Only you know this. It never leaves the store.
                                </p>
                            </div>

                            <form onSubmit={handlePinSubmit} className="flex flex-col gap-3">
                                <div>
                                    <label
                                        htmlFor="staff-pin"
                                        className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau"
                                    >
                                        PIN
                                    </label>
                                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                        <LockClosedIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                        <input
                                            id="staff-pin"
                                            type={showPin ? "text" : "password"}
                                            autoComplete="current-password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            autoFocus
                                            value={pin}
                                            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="flex-1 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPin((v) => !v)}
                                            aria-label={showPin ? "Hide PIN" : "Show PIN"}
                                            className="text-feldgrau transition-colors hover:text-licorice"
                                        >
                                            <EyeIcon className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>

                                {staffError && (
                                    <p className="rounded-lg bg-dark-red/8 px-3 py-2 text-[11px] font-semibold tracking-tight text-dark-red">
                                        {staffError}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || pin.length < 4}
                                    className="
                                        mt-2 flex items-center justify-center gap-2
                                        rounded-full bg-licorice px-5 py-3.5
                                        text-[13px] font-bold tracking-tight text-isabelline
                                        shadow-[0_12px_28px_rgba(35,20,12,0.20)]
                                        ring-1 ring-licorice/80
                                        transition-all duration-200 ease-out
                                        hover:bg-licorice/95 hover:shadow-[0_16px_34px_rgba(35,20,12,0.24)]
                                        active:scale-[0.985]
                                        disabled:opacity-80
                                    "
                                >
                                    {loading ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            </svg>
                                            Signing in…
                                        </>
                                    ) : (
                                        <>
                                            Sign In
                                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step: create PIN (first time) ── */}
                    {step === "create" && (
                        <>
                            <div className="mb-8">
                                <div className="flex items-center gap-2">
                                    <CheckBadgeIcon className="h-4 w-4 text-khaki" strokeWidth={2.25} />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                        {found?.name} · {found?.venueName}
                                    </p>
                                </div>
                                <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                    Create your
                                    <br />
                                    <span className="italic font-serif font-bold text-khaki">
                                        personal PIN
                                    </span>
                                </h1>
                                <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                                    4–6 digits. Only you will know it — it's hashed in the store's
                                    database and can't be reset by anyone else.
                                </p>
                            </div>

                            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
                                <div>
                                    <label
                                        htmlFor="new-pin"
                                        className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau"
                                    >
                                        New PIN
                                    </label>
                                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                        <LockClosedIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                        <input
                                            id="new-pin"
                                            type={showPin ? "text" : "password"}
                                            autoComplete="new-password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            autoFocus
                                            value={pin}
                                            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="flex-1 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPin((v) => !v)}
                                            aria-label={showPin ? "Hide PIN" : "Show PIN"}
                                            className="text-feldgrau transition-colors hover:text-licorice"
                                        >
                                            <EyeIcon className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="confirm-pin"
                                        className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau"
                                    >
                                        Confirm PIN
                                    </label>
                                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                        <LockClosedIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                        <input
                                            id="confirm-pin"
                                            type={showPin ? "text" : "password"}
                                            autoComplete="new-password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={pinConfirm}
                                            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="flex-1 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                        />
                                    </div>
                                    {pinTooShort && (
                                        <p className="mt-1.5 text-[11px] font-semibold tracking-tight text-dark-red">
                                            PIN must be at least 4 digits.
                                        </p>
                                    )}
                                    {pinMismatch && (
                                        <p className="mt-1.5 text-[11px] font-semibold tracking-tight text-dark-red">
                                            PINs don't match.
                                        </p>
                                    )}
                                </div>

                                {staffError && (
                                    <p className="rounded-lg bg-dark-red/8 px-3 py-2 text-[11px] font-semibold tracking-tight text-dark-red">
                                        {staffError}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || pin.length < 4 || pinMismatch}
                                    className="
                                        mt-2 flex items-center justify-center gap-2
                                        rounded-full bg-licorice px-5 py-3.5
                                        text-[13px] font-bold tracking-tight text-isabelline
                                        shadow-[0_12px_28px_rgba(35,20,12,0.20)]
                                        ring-1 ring-licorice/80
                                        transition-all duration-200 ease-out
                                        hover:bg-licorice/95 hover:shadow-[0_16px_34px_rgba(35,20,12,0.24)]
                                        active:scale-[0.985]
                                        disabled:opacity-80
                                    "
                                >
                                    {loading ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            </svg>
                                            Setting up…
                                        </>
                                    ) : (
                                        <>
                                            Set PIN & Sign In
                                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-tight text-feldgrau">
                    <ShieldCheckIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>PIN stored hashed · no Supabase account needed</span>
                </div>
            </div>
        </main>
    );
}
