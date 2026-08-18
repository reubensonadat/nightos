import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { BysenIcon, BysenLogo } from "../../components/BysenLogo";
import { AuthEmbers } from "../../components/three/AuthEmbers";

type AuthShellProps = {
  mode: "login" | "signup";
  children: ReactNode;
  onBack?: () => void;
  onSwitchMode: () => void;
};

const SPRING = { type: "spring", damping: 30, stiffness: 140, mass: 0.9 } as const;

const SLIDES = [
  {
    title: (
      <>
        Run your venue,
        <br />
        <span className="italic text-khaki">in real time.</span>
      </>
    ),
    sub: "Tables, kitchen, payments and your team — one command centre for the whole floor.",
  },
  {
    title: (
      <>
        Your whole floor,
        <br />
        <span className="italic text-khaki">one screen.</span>
      </>
    ),
    sub: "Live tables, kitchen queue and settlements — no more shouting across the room.",
  },
  {
    title: (
      <>
        Start serving,
        <br />
        <span className="italic text-khaki">tonight.</span>
      </>
    ),
    sub: "From the first QR scan to the final settlement — up and running in minutes.",
  },
] as const;

function BrandCarousel({ initialIndex, align }: { initialIndex: number; align: "left" | "right" }) {
  const [slide, setSlide] = useState(initialIndex);
  const isRight = align === "right";

  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      className={`relative z-10 flex h-full flex-col justify-center px-14 ${
        isRight ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <BysenLogo light size="lg" />

      <div className={`mt-10 flex min-h-[230px] flex-col justify-center ${isRight ? "items-end" : "items-start"}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }}
            className={`flex flex-col ${isRight ? "items-end" : "items-start"}`}
          >
            <h2 className="font-serif text-[2.5rem] font-medium leading-[1.12] tracking-[-0.02em] text-isabelline">
              {SLIDES[slide].title}
            </h2>
            <p className={`mt-6 max-w-[320px] text-[13.5px] font-light leading-relaxed text-isabelline/55 ${isRight ? "text-right" : "text-left"}`}>
              {SLIDES[slide].sub}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AuthShell({ mode, children, onBack, onSwitchMode }: AuthShellProps) {
  const isLogin = mode === "login";

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : false,
  );

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div className="min-h-svh w-full bg-isabelline font-sans text-licorice antialiased">
      {/* ══════════ DESKTOP (md+) — split-screen ══════════ */}
      <div className="relative hidden h-svh w-full overflow-hidden bg-white md:block">
        {/* Brand panel — flat licorice, rounded seam */}
        <motion.div
          className="absolute inset-y-0 left-0 z-10 w-1/2"
          initial={false}
          animate={{ x: isLogin ? "0%" : "100%" }}
          transition={SPRING}
        >
          <div className="relative h-full w-full overflow-hidden rounded-md bg-licorice shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
            <img
              src="https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=2560"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/55" />
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(208,186,152,0.10),transparent_55%)]" />
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(169,207,224,0.07),transparent_50%)]" />
            <AuthEmbers />

            <BrandCarousel key={mode} initialIndex={isLogin ? 0 : 2} align={isLogin ? "left" : "right"} />
          </div>
        </motion.div>

        {/* Form panel — white */}
        <motion.div
          className="absolute inset-y-0 right-0 z-0 flex w-1/2 flex-col rounded-md bg-white"
          initial={false}
          animate={{ x: isDesktop ? (isLogin ? "0%" : "-100%") : "0%" }}
          transition={SPRING}
          style={{ overflowY: "auto" }}
        >
          {/* Top nav */}
          <div className="flex shrink-0 items-center justify-between px-8 pt-8">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/10 transition-colors hover:bg-licorice/5 active:scale-95"
                >
                  <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                </button>
              )}
              <BysenIcon size="sm" />
            </div>

            <button
              type="button"
              onClick={onSwitchMode}
              className="text-[12.5px] font-medium text-feldgrau transition-colors hover:text-licorice"
            >
              {isLogin ? (
                <>
                  New to Bysen?{" "}
                  <span className="font-bold text-licorice underline underline-offset-2">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <span className="font-bold text-licorice underline underline-offset-2">Sign in</span>
                </>
              )}
            </button>
          </div>

          {/* Step content */}
          <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
            <div className="mx-auto my-auto w-full max-w-[400px] px-8 py-8">{children}</div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between px-8 pb-8">
            <p className="text-[11px] font-medium text-feldgrau/50">© 2026 Bysen</p>
            <div className="flex gap-5 text-[11px] font-medium text-feldgrau/50">
              <a href="#" className="transition-colors hover:text-licorice">Privacy</a>
              <a href="#" className="transition-colors hover:text-licorice">Terms</a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════ MOBILE (<md) — clean single column ══════════ */}
      <div className="flex min-h-svh flex-col px-6 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)] md:hidden">
        {/* Top nav */}
        <div className="flex items-center justify-between">
          <BysenIcon size="sm" />
          <button
            type="button"
            onClick={onSwitchMode}
            className="text-[12px] font-medium text-feldgrau"
          >
            {isLogin ? (
              <>
                New to Bysen?{" "}
                <span className="font-bold text-licorice underline underline-offset-2">Sign up</span>
              </>
            ) : (
              <>
                <span className="font-bold text-licorice underline underline-offset-2">Sign in</span>
              </>
            )}
          </button>
        </div>

        {/* Hero */}
        <div className="mt-10 mb-7 flex flex-col items-start">
          <h1 className="font-serif text-[1.9rem] font-medium leading-[1.15] tracking-[-0.02em] text-licorice">
            {isLogin ? (
              <>
                Run your venue,
                <br />
                <span className="italic text-khaki">in real time.</span>
              </>
            ) : (
              <>
                Start serving,
                <br />
                <span className="italic text-khaki">tonight.</span>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-[280px] text-[12.5px] font-light leading-relaxed text-feldgrau">
            {isLogin
              ? "Tables, kitchen, payments and your team — one command centre."
              : "From the first QR scan to the final settlement — in minutes."}
          </p>
        </div>

        {/* Form card */}
        <div
          className="relative w-full flex-1"
          style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <div className="my-auto w-full rounded-2xl bg-white p-6 shadow-[0_18px_50px_rgba(35,20,12,0.10)] ring-1 ring-licorice/8">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-colors hover:bg-licorice/5 active:scale-95"
              >
                <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
              </button>
            )}
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10.5px] font-medium text-feldgrau/50">© 2026 Bysen</p>
      </div>
    </div>
  );
}