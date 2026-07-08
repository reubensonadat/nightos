import { useEffect, useState } from "react";
import {
    ArrowRightIcon,
    ClockIcon,
    MapPinIcon,
    MusicalNoteIcon,
    UserIcon
} from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";

function TableIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24.9697 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                d="M2.8911 6.25H22.0786L21.0161 2.5H3.98485L2.8911 6.25V6.25M12.4848 4.375V4.375V4.375V4.375V4.375V4.375M18.4848 8.75H6.5161L6.17235 11.25H18.7973L18.4848 8.75V8.75M2.48485 20L4.0161 8.75H1.23485C0.818182 8.75 0.490057 8.58333 0.250473 8.25C0.0108902 7.91667 -0.0568182 7.55208 0.0473485 7.15625L1.8286 0.90625C1.91193 0.635417 2.05777 0.416667 2.2661 0.25C2.47443 0.0833333 2.72443 0 3.0161 0H21.9536C22.2453 0 22.4953 0.0833333 22.7036 0.25C22.9119 0.416667 23.0578 0.635417 23.1411 0.90625L24.9223 7.15625C25.0265 7.55208 24.9588 7.91667 24.7192 8.25C24.4796 8.58333 24.1515 8.75 23.7348 8.75H20.9848L22.4848 20H19.9848L19.1411 13.75H5.8286L4.98485 20H2.48485V20"
                fill="currentColor"
            />
        </svg>
    );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 20 20.05"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                d="M0 8.05C0 6.38333 0.370833 4.85417 1.1125 3.4625C1.85417 2.07083 2.85 0.916667 4.1 0L5.275 1.6C4.275 2.33333 3.47917 3.25833 2.8875 4.375C2.29583 5.49167 2 6.71667 2 8.05H0V8.05M18 8.05C18 6.71667 17.7042 5.49167 17.1125 4.375C16.5208 3.25833 15.725 2.33333 14.725 1.6L15.9 0C17.15 0.916667 18.1458 2.07083 18.8875 3.4625C19.6292 4.85417 20 6.38333 20 8.05H18V8.05M2 17.05V15.05H4V8.05C4 6.66667 4.41667 5.4375 5.25 4.3625C6.08333 3.2875 7.16667 2.58333 8.5 2.25V1.55C8.5 1.13333 8.64583 0.779167 8.9375 0.4875C9.22917 0.195833 9.58333 0.05 10 0.05C10.4167 0.05 10.7708 0.195833 11.0625 0.4875C11.3542 0.779167 11.5 1.13333 11.5 1.55V2.25C12.8333 2.58333 13.9167 3.2875 14.75 4.3625C15.5833 5.4375 16 6.66667 16 8.05V15.05H18V17.05H2V17.05M10 9.55V9.55V9.55V9.55V9.55V9.55V9.55V9.55V9.55M10 20.05C9.45 20.05 8.97917 19.8542 8.5875 19.4625C8.19583 19.0708 8 18.6 8 18.05H12C12 18.6 11.8042 19.0708 11.4125 19.4625C11.0208 19.8542 10.55 20.05 10 20.05V20.05M6 15.05H14V8.05C14 6.95 13.6083 6.00833 12.825 5.225C12.0417 4.44167 11.1 4.05 10 4.05C8.9 4.05 7.95833 4.44167 7.175 5.225C6.39167 6.00833 6 6.95 6 8.05V15.05V15.05"
                fill="currentColor"
            />
        </svg>
    );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

// Premium Unsplash hero — warm, editorial cocktail imagery
const signatureImg =
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80";
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

const TODAY_LABEL = new Date().toLocaleDateString("en-GH", {
    weekday: "long",
    month: "long",
    day: "numeric",
});

export function WelcomeScreen({ onEnter, onViewReservations, onStaffPortal, onKitchenDisplay, onManagerPortal }: Props) {
    // Live happy-hour countdown — gives the page a "living" feel
    const [now, setNow] = useState(new Date());
    const [staffCalled, setStaffCalled] = useState(false);
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    // Mock happy-hour end at 8pm
    const happyHourEnd = new Date();
    happyHourEnd.setHours(20, 0, 0, 0);
    const happyHourMs = Math.max(0, happyHourEnd.getTime() - now.getTime());
    const happyHourHours = Math.floor(happyHourMs / 3_600_000);
    const happyHourMins = Math.floor((happyHourMs % 3_600_000) / 60_000);
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
                    px-5
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
                <header className="relative z-10 mx-auto max-w-3xl flex items-center justify-between">
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
                            Velvet Lounge
                        </span>
                    </div>

                    <button
                        type="button"
                        className="
                            rounded-full border border-isabelline/20 bg-transparent
                            px-3 py-1.5
                            text-[11px] font-bold uppercase tracking-wider text-isabelline
                            backdrop-blur-md transition-all
                            hover:border-isabelline/40 hover:bg-isabelline/5
                            active:scale-95
                        "
                    >
                        Table 4
                    </button>
                </header>

                {/* ── Hero Greeting ── */}
                <div className="relative z-10 mt-7 mx-auto max-w-3xl">
                    <h1
                        className="
                            mt-0 text-[2.1rem] font-black leading-[1.05]
                            tracking-[-0.04em] text-isabelline
                        "
                    >
                        {getGreeting()},
                        <br />
                        <span className="italic font-serif font-bold text-khaki">
                            Velvet
                        </span>{" "}
                        awaits.
                    </h1>
                    <p className="mt-3 max-w-[300px] text-[13.5px] leading-[1.55] tracking-tight text-isabelline/65">
                        Your corner of the lounge is set. Browse the menu, send
                        your order to the kitchen, and we'll handle the rest.
                    </p>
                </div>

                {/* ── Widget Strip (live data pills) ── */}
                <div className="relative z-10 mt-6 mx-auto max-w-3xl flex flex-wrap gap-2">
                    {/* Happy Hour */}
                    {happyHourActive && (
                        <div
                            className="
                                inline-flex items-center gap-1.5
                                rounded-2xl
                                border border-khaki/30
                                bg-khaki/10
                                px-3 py-2
                                backdrop-blur-md
                            "
                        >
                            <ClockIcon className="h-3.5 w-3.5 text-khaki" />
                            <div className="flex flex-col leading-tight">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-khaki">
                                    Happy Hour
                                </span>
                                <span className="font-mono text-[11px] font-bold tabular-nums text-isabelline">
                                    ends in {happyHourHours}h {happyHourMins}m
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Live Music */}
                    <div
                        className="
                            inline-flex items-center gap-1.5
                            rounded-2xl
                            border border-light-blue/30
                            bg-light-blue/10
                            px-3 py-2
                            backdrop-blur-md
                        "
                    >
                        <MusicalNoteIcon className="h-3.5 w-3.5 text-light-blue" />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-light-blue">
                                Live Jazz
                            </span>
                            <span className="text-[11px] font-bold text-isabelline">
                                9:00 PM
                            </span>
                        </div>
                    </div>

                    {/* Wait time */}
                    <div
                        className="
                            inline-flex items-center gap-1.5
                            rounded-2xl
                            border border-isabelline/15
                            bg-isabelline/5
                            px-3 py-2
                            backdrop-blur-md
                        "
                    >
                        <UserIcon className="h-3.5 w-3.5 text-isabelline/70" />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-isabelline/60">
                                Service
                            </span>
                            <span className="text-[11px] font-bold text-isabelline">
                                ~12 min
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                OVERLAPPING CONTENT — floats above the dark hero
              ═══════════════════════════════════════════════════════════ */}
            <section className="relative z-20 -mt-12 px-5 md:px-8 pb-32 mx-auto max-w-3xl">
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

                {/* ── Figma Table Info & Call Staff Cards ── */}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {/* Table Info Card */}
                    <div
                        className="
                            flex flex-col items-center justify-center
                            bg-[#f4f3f1] border border-[rgba(138,114,108,0.1)]
                            rounded-[12px] p-[17px] w-[167px] h-[128px]
                            shadow-sm transition-all duration-200
                            hover:shadow-md hover:scale-[1.02]
                        "
                    >
                        <TableIcon className="h-7 w-7 text-[#56423d] mb-2" />
                        <h4 className="font-serif text-[20px] font-normal text-[#1a1c1a] leading-tight">
                            Table 04
                        </h4>
                        <p className="font-sans text-[12px] font-medium text-[#56423d] mt-1">
                            2 Seats
                        </p>
                    </div>

                    {/* Call Staff Action Card */}
                    <button
                        type="button"
                        onClick={() => setStaffCalled((prev) => !prev)}
                        className={`
                            flex flex-col items-center justify-center
                            border rounded-[12px] px-[17px] py-[26px] w-[167px] h-[128px]
                            shadow-sm transition-all duration-200
                            hover:shadow-md hover:scale-[1.02] active:scale-95
                            cursor-pointer
                            ${staffCalled
                                ? "bg-khaki/20 border-khaki/30 text-khaki"
                                : "bg-[rgba(255,218,210,0.3)] border-[rgba(160,63,40,0.2)] text-[#a03f28]"
                            }
                        `}
                    >
                        <div className="h-[56px] flex flex-col items-start pb-[8px] relative w-[48px]">
                            <div
                                className={`
                                    flex items-center justify-center rounded-full h-12 w-12 transition-colors duration-200
                                    ${staffCalled ? "bg-khaki" : "bg-[#c0573e]"}
                                `}
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    {staffCalled ? (
                                        <CheckIcon className="h-5 w-5 text-licorice" />
                                    ) : (
                                        <BellIcon className="h-5 w-5 text-licorice" />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <span className="font-sans font-semibold text-[14px] leading-[20px] tracking-[0.7px] whitespace-nowrap">
                                {staffCalled ? "Called!" : "Call Staff"}
                            </span>
                        </div>
                    </button>
                </div>

                {/* Staff Called Alert Banner */}
                {staffCalled && (
                    <div className="mt-3 flex justify-center animate-velvet-rise">
                        <p className="text-[11px] font-semibold tracking-tight text-khaki bg-licorice/40 px-3 py-1 rounded-full backdrop-blur-sm">
                            ✓ Server has been notified — Kojo is on the way to Table 04
                        </p>
                    </div>
                )}

                {/* ── Ambient strip — editorial detail ── */}
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-isabelline">
                        <img
                            src={ambientImg}
                            alt="Velvet Lounge interior"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">
                            From the bar
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold leading-tight tracking-tight text-licorice line-clamp-2">
                            "Tonight's bar is being led by Ama — ask her about
                            the off-menu smoky Negroni."
                        </p>
                    </div>
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
                    px-5
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
