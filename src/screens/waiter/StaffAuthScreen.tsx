import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneIcon, ArrowLeftIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../context/AuthContext";
import OtpInput from "../../components/OtpInput";

const OTP_COOLDOWN_SECONDS = 60;
const OTP_STORAGE_KEY = "bysen:otp_pending";

export function StaffAuthScreen() {
    const { signInWithPhone, verifyPhoneOtp, staffSession, role } = useAuth();
    
    // State to toggle between "phone" entry and "verify" OTP
    const [step, setStep] = useState<"phone" | "verify">(() => {
        try {
            const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
            return raw ? "verify" : "phone";
        } catch {
            return "phone";
        }
    });

    const [phone, setPhone] = useState(() => {
        try {
            const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
            return raw ? JSON.parse(raw).phone : "";
        } catch {
            return "";
        }
    });

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth >= 1024 : false
    );

    const [cooldown, setCooldown] = useState(() => {
        try {
            const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
            if (raw) {
                const { sentAt } = JSON.parse(raw);
                const elapsed = Math.floor((Date.now() - (sentAt || 0)) / 1000);
                const remaining = OTP_COOLDOWN_SECONDS - elapsed;
                return remaining > 0 ? remaining : 0;
            }
        // eslint-disable-next-line no-empty
        } catch {}
        return 0;
    });

    const [justVerified, setJustVerified] = useState(false);

    useEffect(() => {
        if (justVerified && !staffSession && role !== 'owner') {
            toast.error("This number isn't linked to a staff profile. Ask your manager to add it, then try again.");
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setJustVerified(false);
        }
    }, [justVerified, staffSession, role]);

    useEffect(() => {
        const handler = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cooldown > 0 || !phone) return;
        setError(null);
        setLoading(true);

        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "+233" + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith("233")) {
            formattedPhone = "+" + formattedPhone;
        } else if (!formattedPhone.startsWith("+")) {
            formattedPhone = "+" + formattedPhone;
        }

        const { error } = await signInWithPhone(formattedPhone);
        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setPhone(formattedPhone);
            sessionStorage.setItem(
                OTP_STORAGE_KEY,
                JSON.stringify({ phone: formattedPhone, sentAt: Date.now() })
            );
            toast("Your code expires in 4 minutes", { icon: "⏳" });
            setStep("verify");
            setCooldown(OTP_COOLDOWN_SECONDS);
        }
    };

    const handleVerify = async (e: React.FormEvent | null, autoSubmitOtp: string | null = null) => {
        if (e) e.preventDefault();
        const otpToVerify = autoSubmitOtp || otp;
        if (!otpToVerify || otpToVerify.length !== 6) return;

        setError(null);
        setLoading(true);

        const { error } = await verifyPhoneOtp(phone, otpToVerify);
        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            sessionStorage.removeItem(OTP_STORAGE_KEY);
            setJustVerified(true);
            toast.success("Successfully signed in");
        }
    };

    const handleResend = async () => {
        if (cooldown > 0 || resending) return;
        setError(null);
        setResending(true);

        const { error } = await signInWithPhone(phone);
        setResending(false);

        if (error) {
            setError(error.message);
        } else {
            sessionStorage.setItem(
                OTP_STORAGE_KEY,
                JSON.stringify({ phone, sentAt: Date.now() })
            );
            setCooldown(OTP_COOLDOWN_SECONDS);
            setOtp("");
            toast("New code sent — expires in 4 minutes", { icon: "⏳" });
        }
    };

    const handleChangePhone = () => {
        sessionStorage.removeItem(OTP_STORAGE_KEY);
        setStep("phone");
        setError(null);
        setOtp("");
    };

    return (
        <div className="relative min-h-screen w-full bg-white overflow-hidden flex selection:bg-black/20 selection:text-black">
            {/* Showcase panel (Dark) — desktop only */}
            <motion.div
                className="absolute top-0 bottom-0 w-1/2 z-20 bg-[#0a0a0a] shadow-2xl hidden lg:block"
                initial={false}
                animate={{ x: step === "phone" ? "0%" : "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 120 }}
            >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-[#0a0a0a] to-[#050505] p-12 flex flex-col justify-between text-white">
                    <div className="inline-block group mb-8">
                        <div className="bg-white p-1 rounded-md shadow-sm flex items-center justify-center transition-transform group-hover:scale-105 inline-block">
                            <div className="h-6 w-auto px-2 font-bold text-black flex items-center justify-center">Velvet Lounge</div>
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center pb-20">
                        {step === "phone" ? (
                            <>
                                <h2 className="text-5xl lg:text-6xl font-display font-medium mb-6 leading-tight tracking-tight drop-shadow-lg">
                                    Welcome <br />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/70 to-white/30">back.</span>
                                </h2>
                                <p className="text-white/50 text-lg font-light leading-relaxed max-w-md">
                                    Sign in with your phone number to access the POS system and start managing orders.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="inline-flex self-start items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mb-8">
                                    One last step
                                </div>
                                <h2 className="text-5xl lg:text-6xl font-display font-medium mb-6 leading-tight tracking-tight drop-shadow-lg">
                                    Almost <br />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/70 to-white/30">there.</span>
                                </h2>
                                <p className="text-white/50 text-lg font-light leading-relaxed max-w-md">
                                    Enter the code we just sent to your phone. This keeps the system secure and confirms it's really you.
                                </p>
                                <ul className="space-y-4 mb-8 max-w-md mt-8">
                                    <li className="flex items-center gap-3 text-base text-white/80 font-light"><CheckBadgeIcon className="h-5 w-5 text-white/60" /> Codes expire in 4 minutes</li>
                                    <li className="flex items-center gap-3 text-base text-white/80 font-light"><CheckBadgeIcon className="h-5 w-5 text-white/60" /> We never share your number</li>
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Form panel */}
            <motion.div
                className="absolute top-0 bottom-0 w-full lg:w-1/2 z-10 flex items-center justify-center p-6 sm:p-8 lg:p-12"
                initial={false}
                animate={{ x: isDesktop ? (step === "phone" ? "100%" : "0%") : "0%" }}
                transition={{ type: "spring", damping: 25, stiffness: 120 }}
            >
                {/* Mobile logo */}
                <div className="absolute top-6 left-6 lg:hidden z-10">
                    <div className="inline-block group mb-6">
                        <div className="bg-white p-1 rounded-md shadow-sm flex items-center justify-center transition-transform group-hover:scale-105 inline-block">
                            <div className="h-5 w-auto px-1.5 font-bold text-black flex items-center justify-center text-sm">Velvet Lounge</div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-md relative pt-16 lg:pt-0">
                    <AnimatePresence mode="wait">
                        {step === "phone" ? (
                            <motion.div
                                key="phone"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-8 sm:mb-10">
                                    <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#111] mb-2 tracking-tight">
                                        Sign in
                                    </h1>
                                    <p className="text-[#111]/50 text-sm sm:text-base font-light">
                                        Welcome back. Enter your phone number to continue.
                                    </p>
                                </div>

                                <form onSubmit={handleSendOtp} className="space-y-4 sm:space-y-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-gray-700">Phone number</label>
                                        <div className="relative">
                                            <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="tel"
                                                required
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="+233 24 123 4567"
                                                autoComplete="tel"
                                                className="h-11 w-full rounded-md border bg-white pl-9 px-3 text-sm text-gray-800 placeholder:text-gray-400 transition-colors duration-150 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/20 border-gray-200"
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={cooldown > 0 || loading}
                                        className="w-full h-11 bg-[#111] hover:bg-black text-white font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Sending..." : cooldown > 0 ? `Resend available in ${cooldown}s` : "Continue with Phone"}
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="verify"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-8 sm:mb-10">
                                    <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#111] mb-2 tracking-tight">
                                        Verify your number
                                    </h1>
                                    <p className="text-[#111]/50 text-sm sm:text-base font-light">
                                        Enter the 6-digit code we sent to{" "}
                                        <span className="font-semibold text-[#111]">{phone}</span>.
                                    </p>
                                </div>

                                <form onSubmit={(e) => handleVerify(e)} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-[#111]">Verification Code</label>
                                        <OtpInput
                                            length={6}
                                            value={otp}
                                            onChange={setOtp}
                                            onComplete={(val: string) => handleVerify(null, val)}
                                            disabled={loading}
                                            inputClassName="flex-1 min-w-0 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-display font-medium text-black bg-white border-2 border-gray-200 rounded-2xl focus:border-[#111] focus:ring-2 focus:ring-[#111]/15 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {error && (
                                        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={otp.length !== 6 || loading}
                                        className="w-full h-11 bg-[#111] hover:bg-black text-white font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Verifying..." : "Verify & Continue"}
                                    </button>
                                </form>

                                <div className="mt-6 text-center text-sm text-[#111]/60 min-h-[20px]">
                                    {cooldown > 0 ? (
                                        <span>
                                            Resend code in{" "}
                                            <span className="font-semibold text-[#111]">{cooldown}s</span>
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResend}
                                            disabled={resending}
                                            className="font-semibold text-[#111] hover:underline disabled:opacity-50 transition-opacity"
                                        >
                                            {resending ? "Sending…" : "Didn't get a code? Resend"}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-6 text-center">
                                    <button
                                        type="button"
                                        onClick={handleChangePhone}
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                                    >
                                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={1.5} />
                                        Change phone number
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
