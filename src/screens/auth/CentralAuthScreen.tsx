import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useAuth, sectorPath } from "../../context/AuthContext";
import { authDb } from "../../lib/db/auth";
import { AuthShell } from "./AuthShell";
import { Divider, ErrorBanner, PrimaryButton, TextField } from "./AuthField";
import OtpInput from "../../components/OtpInput";

type Step = "login" | "otp" | "signup" | "staffNotice";
type ShellMode = "login" | "signup";

const OTP_COOLDOWN_SECONDS = 60;
const OTP_STORAGE_KEY = "bysen:otp_pending";

const looksLikeEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

function normalisePhone(raw: string): string {
  const p = raw.replace(/[\s-()]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("233")) return "+" + p;
  if (p.startsWith("0")) return "+233" + p.slice(1);
  return "+" + p;
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)} ••• ${phone.slice(-3)}`;
}

const slide = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12.03 12.03 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function SocialAuthRow({
  onGoogle,
  onApple,
  disabled,
}: {
  onGoogle: () => void;
  onApple: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-licorice/10 bg-white text-[13px] font-semibold text-licorice transition-all hover:bg-isabelline active:scale-[0.985] disabled:opacity-60"
      >
        <GoogleIcon className="h-[18px] w-[18px]" />
        Continue with Google
      </button>
      <button
        type="button"
        onClick={onApple}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-licorice text-[13px] font-semibold text-isabelline transition-all hover:bg-licorice/90 active:scale-[0.985] disabled:opacity-60"
      >
        <AppleIcon className="h-[18px] w-[18px]" />
        Continue with Apple
      </button>
    </div>
  );
}

export function CentralAuthScreen({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isInitializing,
    signIn,
    signUp,
    signInWithPhone,
    signUpWithPhone,
    signInWithOAuth,
    verifyPhoneOtp,
    resetPassword,
    role,
    signOut,
  } = useAuth();

  const [step, setStep] = useState<Step>(initialMode === "signup" ? "signup" : "login");
  const [shellMode, setShellMode] = useState<ShellMode>(initialMode === "signup" ? "signup" : "login");
  const [identifier, setIdentifier] = useState("");
  const [signupIdentifier, setSignupIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const [otp, setOtp] = useState("");

  const nfTimer = useRef<number | null>(null);
  const sentPhone = useRef<string | null>(null);
  const nfIdentifier = useRef<string | null>(null);
  const isPhoneSignup = useRef(false);

  const emailMode = useMemo(() => looksLikeEmail(identifier), [identifier]);
  const signupEmailMode = useMemo(() => looksLikeEmail(signupIdentifier), [signupIdentifier]);
  const loginReady = identifier.trim().length > 0 && (!emailMode || password.length > 0);
  const signupReady =
    name.trim().length > 0 &&
    signupIdentifier.trim().length > 0 &&
    (!signupEmailMode || password.length >= 6);

  const clearNfTimer = useCallback(() => {
    if (nfTimer.current !== null) {
      window.clearTimeout(nfTimer.current);
      nfTimer.current = null;
    }
  }, []);

  const cancelNoAccount = useCallback(() => {
    clearNfTimer();
    nfIdentifier.current = null;
  }, [clearNfTimer]);

  useEffect(() => cancelNoAccount, [cancelNoAccount]);

  const startNoAccountFlow = useCallback(
    (targetStep: Step, id: string) => {
      clearNfTimer();
      nfIdentifier.current = id;
      toast("No account found for that email or phone.", { id: "nf-1", duration: 2000 });
      nfTimer.current = window.setTimeout(() => {
        toast("Let's get you set up — it takes less than a minute.", { id: "nf-2", duration: 2000 });
        nfTimer.current = window.setTimeout(() => {
          if (targetStep === "signup" && nfIdentifier.current) {
            setSignupIdentifier(nfIdentifier.current);
          }
          setStep(targetStep);
          setShellMode(targetStep === "signup" ? "signup" : "login");
          nfTimer.current = null;
        }, 900);
      }, 1300);
    },
    [clearNfTimer],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing) return;
    cancelNoAccount();
    if (role) navigate(sectorPath(role), { replace: true });
  }, [isAuthenticated, isInitializing, role, navigate, cancelNoAccount]);

  const goLogin = useCallback(() => {
    cancelNoAccount();
    setError(null);
    setStep("login");
    setShellMode("login");
  }, [cancelNoAccount]);

  const switchMode = useCallback(() => {
    cancelNoAccount();
    setError(null);
    setStep((s) => (s === "signup" ? "login" : "signup"));
    setShellMode((m) => (m === "signup" ? "login" : "signup"));
  }, [cancelNoAccount]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || isAuthenticated) return;
    cancelNoAccount();
    setError(null);
    const id = identifier.trim();

    if (emailMode) {
      setBusy(true);
      const { error: signInErr, role: resolvedRole } = await signIn(id, password);
      setBusy(false);
      if (signInErr) {
        if (/invalid login credentials/i.test(signInErr.message)) {
          startNoAccountFlow("signup", id);
        } else {
          setError(signInErr.message);
        }
        return;
      }
      if (!resolvedRole) {
        await signOut();
        startNoAccountFlow("signup", id);
        return;
      }
      toast.success("Welcome back.");
      navigate(sectorPath(resolvedRole), { replace: true });
      return;
    }

    const p = normalisePhone(id);
    if (!/^\+[1-9]\d{8,14}$/.test(p)) {
      setError("That phone number doesn't look right — try +233 XX XXX XXXX.");
      return;
    }
    // Preflight: resolve the number BEFORE sending an OTP. If it isn't
    // an active staff member or a venue owner's phone, don't create a
    // phantom auth user — go straight to the no-account flow instead
    // of signing the user in and then bouncing them back out.
    setBusy(true);
    const [{ data: staffMatch }, { data: ownerMatch }] = await Promise.all([
      authDb.venueByStaffPhone(p),
      authDb.venueByPhone(p),
    ]);
    setBusy(false);
    if (!staffMatch && !ownerMatch) {
      startNoAccountFlow("signup", p);
      return;
    }
    setBusy(true);
    const { error: otpErr } = await signInWithPhone(p);
    setBusy(false);
    if (otpErr) {
      const msg = otpErr.message;
      if (/signups? not allowed/i.test(msg)) {
        startNoAccountFlow("signup", p);
      } else {
        setError(msg);
      }
      return;
    }
    isPhoneSignup.current = false;
    sentPhone.current = p;
    setPhone(p);
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ phone: p, sentAt: Date.now() }));
    setCooldown(OTP_COOLDOWN_SECONDS);
    setOtp("");
    setStep("otp");
  };

  const handleForgot = async () => {
    if (busy || isAuthenticated || !emailMode || !identifier.trim()) return;
    cancelNoAccount();
    setError(null);
    setBusy(true);
    const { error } = await resetPassword(identifier.trim());
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success("Password reset link sent — check your email.");
  };

  const handleVerifyOtp = async (token: string) => {
    if (busy || isAuthenticated || !sentPhone.current) return;
    setBusy(true);
    setError(null);
    const { error: verifyErr, role: resolvedRole } = await verifyPhoneOtp(sentPhone.current, token);
    setBusy(false);
    if (verifyErr) {
      setError(verifyErr.message);
      return;
    }
    sessionStorage.removeItem(OTP_STORAGE_KEY);
    if (!resolvedRole) {
      if (isPhoneSignup.current) {
        toast.success("Account created — let's set up your venue.");
        navigate("/setup", { replace: true });
      } else {
        await signOut();
        startNoAccountFlow("staffNotice", sentPhone.current);
      }
      return;
    }
    toast.success("Signed in.");
    navigate(sectorPath(resolvedRole), { replace: true });
  };

  const handleResend = async () => {
    if (busy || cooldown > 0 || isAuthenticated || !sentPhone.current) return;
    setBusy(true);
    setError(null);
    const { error: otpErr } = await signInWithPhone(sentPhone.current);
    setBusy(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    setCooldown(OTP_COOLDOWN_SECONDS);
    setOtp("");
    toast("New code sent — expires in 4 minutes.", { icon: "⏳" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || isAuthenticated) return;
    cancelNoAccount();
    setError(null);
    const id = signupIdentifier.trim();

    if (signupEmailMode) {
      setBusy(true);
      const { error: upErr } = await signUp(id, password);
      setBusy(false);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      toast.success("Account created — let's set up your venue.");
      navigate("/setup", { replace: true });
      return;
    }

    const p = normalisePhone(id);
    if (!/^\+[1-9]\d{8,14}$/.test(p)) {
      setError("That phone number doesn't look right — try +233 XX XXX XXXX.");
      return;
    }
    setBusy(true);
    const { error: otpErr } = await signUpWithPhone(p);
    setBusy(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    isPhoneSignup.current = true;
    sentPhone.current = p;
    setPhone(p);
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ phone: p, sentAt: Date.now() }));
    setCooldown(OTP_COOLDOWN_SECONDS);
    setOtp("");
    setStep("otp");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    if (busy || isAuthenticated) return;
    cancelNoAccount();
    setError(null);
    setBusy(true);
    const { error: oauthErr } = await signInWithOAuth(provider);
    setBusy(false);
    if (oauthErr) setError(oauthErr.message);
  };

  const handleInput = (setter: (v: string) => void) => (v: string) => {
    cancelNoAccount();
    setter(v);
  };

  return (
    <AuthShell mode={shellMode} onBack={step === "otp" || step === "staffNotice" ? goLogin : undefined} onSwitchMode={switchMode}>
      <AnimatePresence mode="wait">
        {step === "login" && (
          <motion.div key="login" {...slide}>
            <div className="mb-8 text-center">
              <h1 className="text-[24px] font-black tracking-[-0.03em] text-licorice">Sign in to Bysen</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                Welcome back — enter your email or phone to continue.
              </p>
            </div>

            <SocialAuthRow onGoogle={() => handleOAuth("google")} onApple={() => handleOAuth("apple")} disabled={busy} />

            <Divider label="or" />

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <TextField
                label="Email or phone"
                value={identifier}
                onChange={handleInput(setIdentifier)}
                placeholder="you@venue.com  ·  +233 24 123 4567"
                icon={
                  emailMode ? (
                    <EnvelopeIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <DevicePhoneMobileIcon className="h-[18px] w-[18px]" />
                  )
                }
                autoComplete="username"
                autoFocus
              />

              {emailMode ? (
                <div className="relative">
                  <TextField
                    label="Password"
                    value={password}
                    onChange={handleInput(setPassword)}
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    icon={<LockClosedIcon className="h-[18px] w-[18px]" />}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-[10px] font-bold uppercase tracking-wider text-feldgrau hover:text-licorice"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    }
                  />
                </div>
              ) : (
                <p className="rounded-lg bg-khaki/10 px-4 py-2.5 text-[12px] font-medium leading-relaxed text-feldgrau">
                  We'll text you a 6-digit code to verify it's you.
                </p>
              )}

              <ErrorBanner message={error} />

              <PrimaryButton loading={busy} disabled={!loginReady} withArrow>
                {emailMode ? "Sign in" : "Continue with Phone"}
              </PrimaryButton>
            </form>

            {emailMode && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-[12px] font-semibold text-feldgrau underline-offset-2 hover:text-licorice hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === "otp" && (
          <motion.div key="otp" {...slide}>
            <div className="mb-8 text-center">
              <h1 className="text-[24px] font-black tracking-[-0.03em] text-licorice">Verify your number</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-licorice">{maskPhone(phone)}</span>
                {" "}·{" "}
                <button type="button" onClick={goLogin} className="font-semibold text-khaki hover:underline">
                  change
                </button>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <OtpInput
                length={6}
                value={otp}
                onChange={setOtp}
                onComplete={handleVerifyOtp}
                disabled={busy}
              />

              <ErrorBanner message={error} />

              <div className="text-center text-[12px] text-feldgrau">
                {cooldown > 0 ? (
                  <span>
                    Resend code in <span className="font-bold text-licorice">{cooldown}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy}
                    className="font-semibold text-licorice underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    Didn't get a code? Resend
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === "signup" && (
          <motion.div key="signup" {...slide}>
            <div className="mb-8 text-center">
              <h1 className="text-[24px] font-black tracking-[-0.03em] text-licorice">Create your venue</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                Owners sign up here. Staff accounts are created by your manager.
              </p>
            </div>

            <SocialAuthRow onGoogle={() => handleOAuth("google")} onApple={() => handleOAuth("apple")} disabled={busy} />

            <Divider label="or" />

            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <TextField
                label="Full name"
                value={name}
                onChange={handleInput(setName)}
                placeholder="Kwame Mensah"
                icon={<UserIcon className="h-[18px] w-[18px]" />}
                autoComplete="name"
              />
              <TextField
                label="Email or phone"
                value={signupIdentifier}
                onChange={handleInput(setSignupIdentifier)}
                placeholder="you@venue.com  ·  +233 24 123 4567"
                icon={
                  signupEmailMode ? (
                    <EnvelopeIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <DevicePhoneMobileIcon className="h-[18px] w-[18px]" />
                  )
                }
                autoComplete="username"
              />

              {signupEmailMode ? (
                <div className="relative">
                  <TextField
                    label="Password"
                    value={password}
                    onChange={handleInput(setPassword)}
                    placeholder="Create a strong password"
                    type={showPassword ? "text" : "password"}
                    icon={<LockClosedIcon className="h-[18px] w-[18px]" />}
                    autoComplete="new-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-[10px] font-bold uppercase tracking-wider text-feldgrau hover:text-licorice"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    }
                  />
                </div>
              ) : (
                <p className="rounded-lg bg-khaki/10 px-4 py-2.5 text-[12px] font-medium leading-relaxed text-feldgrau">
                  We'll text you a 6-digit code to verify this number — no password needed.
                </p>
              )}

              <ErrorBanner message={error} />

              <PrimaryButton loading={busy} disabled={!signupReady} withArrow>
                {signupEmailMode ? "Create free account" : "Continue with Phone"}
              </PrimaryButton>
            </form>
          </motion.div>
        )}

        {step === "staffNotice" && (
          <motion.div key="staffNotice" {...slide}>
            <div className="mb-8 text-center">
              <h1 className="text-[24px] font-black tracking-[-0.03em] text-licorice">No staff account found</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                That number isn't linked to a staff profile at any venue yet.
                Ask your manager to add you in{" "}
                <span className="font-semibold text-licorice">Staff Manager</span> — then sign in again.
              </p>
            </div>
            <PrimaryButton onClick={goLogin}>Back to sign in</PrimaryButton>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}