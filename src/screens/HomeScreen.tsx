import { useEffect, useState } from "react";
import {
    ArrowRightIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ClockIcon,
    MapPinIcon,
    MusicalNoteIcon,
    UserIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    WifiIcon,
} from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";
import { useVenue } from "../hooks/useVenue";

// Premium Unsplash hero — warm, editorial cocktail imagery
const signatureImg =
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ambientImg =
    "https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=600&q=80";

type Props = {
    onEnter: () => void;
    onViewReservations?: () => void;
    onStaffPortal?: () => void;
    onKitchenDisplay?: () => void;
    onManagerPortal?: () => void;
};

/** Time-based greeting — same pattern Campus Guide uses. */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TODAY_LABEL = new Date().toLocaleDateString("en-GH", {
    weekday: "long",
    month: "long",
    day: "numeric",
});

export function HomeScreen({ onEnter, onViewReservations, onStaffPortal, onKitchenDisplay, onManagerPortal }: Props) {
    const { venue } = useVenue('velvet-lounge');

    // Live happy-hour countdown — gives the page a "living" feel
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    // Mock happy-hour end at 8pm
    const happyHourEnd = new Date();
    happyHourEnd.setHours(20, 0, 0, 0);
    const happyHourMs = Math.max(0, happyHourEnd.getTime() - now.getTime());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const happyHourHours = Math.floor(happyHourMs / 3_600_000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const happyHourMins = Math.floor((happyHourMs % 3_600_000) / 60_000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const happyHourActive = happyHourMs > 0;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                DARK LICORICE HERO with Khaki + Light-Blue blur orbs
                (inspired by Campus Guide's gray-900 hero)
              ═══════════════════════════════════════════════════════════ */}
            <div
                className="
                    relative overflow-hidden
                    bg-gradient-to-b from-licorice via-licorice to-licorice/95
                    pt-[max(env(safe-area-inset-top),20px)]
                    pb-24
                "
            >
                {/* Ambient blur orbs — Khaki warm + Light-Blue cool */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-khaki mix-blend-screen blur-[80px] opacity-20" />
                    <div className="absolute top-32 -left-20 h-64 w-64 rounded-full bg-light-blue mix-blend-screen blur-[80px] opacity-15" />
                    <div className="absolute bottom-0 left-1/2 h-40 w-[150%] -translate-x-1/2 rounded-[100%] bg-licorice blur-2xl opacity-50" />
                </div>

                {/* ── Top Bar ── */}
                <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="
                                flex h-9 w-9 items-center justify-center
                                rounded-full bg-isabelline text-licorice
                                shadow-[0_4px_14px_rgba(0,0,0,0.3)]
                            "
                        >
                            <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                                V
                            </span>
                        </div>
                        <span className="text-[13px] font-bold tracking-tight text-isabelline">
                            {venue.name}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Table status */}
                        <div className="flex items-center gap-1.5 rounded-full border border-isabelline/15 bg-isabelline/5 px-3 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-isabelline/80">
                                Table 4
                            </span>
                        </div>
                    </div>
                </header>

                {/* ── Hero Greeting ── */}
                <div className="relative z-10 mt-7 mx-auto w-full max-w-7xl px-5 md:px-8">
                    <h1
                        className="
                            mt-2 text-[2.1rem] font-black leading-[1.05]
                            tracking-[-0.04em] text-isabelline
                        "
                    >
                        {getGreeting()},
                        <br />
                        <span className="italic font-serif font-bold text-khaki">
                            {venue.name.split(' ')[0]}
                        </span>{" "}
                        awaits.
                    </h1>
                    <p className="mt-3 max-w-[300px] text-[13.5px] leading-[1.55] tracking-tight text-isabelline/65">
                        Your corner of the lounge is set. Browse the menu, send
                        your order to the kitchen, and we'll handle the rest.
                    </p>
                </div>


            </div>

            {/* ═══════════════════════════════════════════════════════════
                OVERLAPPING CONTENT — floats above the dark hero
              ═══════════════════════════════════════════════════════════ */}
            <section className="relative z-20 mx-auto w-full max-w-7xl -mt-12 px-5 md:px-8 pb-32">
                {/* ── Featured Signature Card (the hero cocktail) ── */}
                <div
                    className="
                        relative overflow-hidden rounded-3xl
                        bg-white
                        shadow-[0_24px_60px_rgba(35,20,12,0.18)]
                        ring-1 ring-isabelline
                    "
                >
                    {/* Image header — clean, no ribbons */}
                    <div className="relative h-56 w-full overflow-hidden">
                        <img
                            src={signatureImg}
                            alt="Tonight's signature — Hibiscus Spritz"
                            className="h-full w-full object-cover"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white"
                        />
                    </div>

                    {/* Body — editorial, restrained */}
                    <div className="px-5 pb-5 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                            Tonight's Signature
                        </p>
                        <div className="mt-1.5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-[22px] font-bold leading-tight tracking-[-0.035em] text-licorice">
                                    Hibiscus Spritz
                                </h2>
                                <p className="mt-1.5 text-[12.5px] leading-[1.55] tracking-tight text-feldgrau line-clamp-2">
                                    Prosecco, hibiscus cordial, fresh lime,
                                    topped with soda and edible petals.
                                </p>
                            </div>
                            <span className="shrink-0 font-mono text-[18px] font-bold tabular-nums text-licorice">
                                {formatGHS(95)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Two-column widget grid ── */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* Your Table */}
                    <div
                        className="
                            rounded-2xl bg-white p-4
                            shadow-[0_8px_24px_rgba(35,20,12,0.06)]
                            ring-1 ring-isabelline
                        "
                    >
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-dark-red/10">
                                <MapPinIcon className="h-3.5 w-3.5 text-dark-red" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                                Your Table
                            </span>
                        </div>
                        <p className="mt-3 text-[28px] font-black leading-none tracking-[-0.04em] text-licorice">
                            04
                        </p>
                        <p className="mt-1 text-[11px] font-medium tracking-tight text-feldgrau">
                            Window seat · 4 guests
                        </p>
                        <div className="mt-3 flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-khaki ring-2 ring-white" />
                            <span className="text-[10px] font-semibold tracking-tight text-licorice">
                                Kojo · Server
                            </span>
                        </div>
                    </div>

                    {/* Vibe Tonight */}
                    <button
                        type="button"
                        onClick={onViewReservations}
                        className="
                            relative overflow-hidden rounded-2xl
                            bg-licorice p-4 text-isabelline
                            shadow-[0_8px_24px_rgba(35,20,12,0.18)]
                            text-left transition-transform active:scale-[0.98]
                        "
                    >
                        <div
                            aria-hidden="true"
                            className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-khaki/20 blur-2xl pointer-events-none"
                        />
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-isabelline/10">
                                    <MusicalNoteIcon className="h-3.5 w-3.5 text-khaki" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-isabelline/60">
                                    Vibe Tonight
                                </span>
                            </div>
                            <p className="mt-3 text-[15px] font-bold leading-tight tracking-tight">
                                Live Jazz
                                <br />
                                <span className="italic font-serif font-medium text-khaki">
                                    The Velvet Trio
                                </span>
                            </p>
                            <p className="mt-2 text-[10px] font-medium tracking-tight text-isabelline/60">
                                9:00 PM → Midnight
                            </p>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-khaki">
                                See all events →
                            </p>
                        </div>
                    </button>
                </div>



                {/* ── Staff & Operations entries — discreet, for staff only ── */}
                {(onStaffPortal || onKitchenDisplay || onManagerPortal) && (
                    <div className="mt-6">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="h-px flex-1 bg-licorice/8" />
                            <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-feldgrau/40">
                                Staff & Operations
                            </span>
                            <span className="h-px flex-1 bg-licorice/8" />
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {onStaffPortal && (
                                <button
                                    type="button"
                                    onClick={onStaffPortal}
                                    className="
                                        inline-flex items-center gap-1.5
                                        rounded-full bg-white/60 px-3 py-1.5
                                        text-[10px] font-bold uppercase tracking-[0.18em]
                                        text-feldgrau/70
                                        ring-1 ring-licorice/6
                                        transition-all duration-200
                                        hover:text-licorice hover:bg-white hover:ring-licorice/15 hover:shadow-sm
                                        active:scale-95
                                    "
                                >
                                    <UserIcon className="h-3 w-3" />
                                    Waiter
                                </button>
                            )}
                            {onKitchenDisplay && (
                                <button
                                    type="button"
                                    onClick={onKitchenDisplay}
                                    className="
                                        inline-flex items-center gap-1.5
                                        rounded-full bg-white/60 px-3 py-1.5
                                        text-[10px] font-bold uppercase tracking-[0.18em]
                                        text-feldgrau/70
                                        ring-1 ring-licorice/6
                                        transition-all duration-200
                                        hover:text-licorice hover:bg-white hover:ring-licorice/15 hover:shadow-sm
                                        active:scale-95
                                    "
                                >
                                    <MusicalNoteIcon className="h-3 w-3" />
                                    Kitchen
                                </button>
                            )}
                            {onManagerPortal && (
                                <button
                                    type="button"
                                    onClick={onManagerPortal}
                                    className="
                                        inline-flex items-center gap-1.5
                                        rounded-full bg-white/60 px-3 py-1.5
                                        text-[10px] font-bold uppercase tracking-[0.18em]
                                        text-feldgrau/70
                                        ring-1 ring-licorice/6
                                        transition-all duration-200
                                        hover:text-licorice hover:bg-white hover:ring-licorice/15 hover:shadow-sm
                                        active:scale-95
                                    "
                                >
                                    <UserIcon className="h-3 w-3" />
                                    Manager
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                STICKY BOTTOM CTA — floats above everything
              ═══════════════════════════════════════════════════════════ */}
            <div
                className="
                    fixed inset-x-0 bottom-0 z-30
                    flex justify-center
                    px-5 md:px-8
                    pb-[max(env(safe-area-inset-bottom),18px)]
                    pt-3
                    bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent
                "
            >
                <button
                    type="button"
                    onClick={onEnter}
                    className="
                        group flex w-full max-w-md md:max-w-2xl items-center justify-between
                        gap-3 rounded-full
                        bg-licorice px-6 py-4
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
                            Open the menu
                        </span>
                        <span className="text-[15px] font-bold tracking-tight text-isabelline">
                            Start Ordering
                        </span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                </button>
            </div>
        </main>
    );
}
