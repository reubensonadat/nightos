import {
    ArrowRightIcon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    FireIcon,
    PhoneIcon,
    QrCodeIcon,
    UserGroupIcon,
} from "@heroicons/react/24/solid";

/* ────────────────────────── Props ────────────────────────── */

type Props = {
    onEnterCustomer: () => void;
    onViewReservations: () => void;
    onStaffPortal: () => void;
    onKitchenDisplay: () => void;
    onManagerPortal: () => void;
};

const PORTALS = [
    {
        key: "customer",
        title: "Customer",
        tag: "QR ordering",
        blurb: "Scan a table QR, browse the menu, order straight to the kitchen, track it live, pay when served.",
        icon: QrCodeIcon,
        accent: "text-khaki",
        ring: "ring-khaki/30",
        bg: "bg-khaki/10",
        onClick: undefined as (() => void) | undefined,
    },
    {
        key: "waiter",
        title: "Waiter",
        tag: "Floor operations",
        blurb: "Phone + PIN sign-in. See your tables, take orders, cancel mistakes, settle cash bills.",
        icon: UserGroupIcon,
        accent: "text-light-blue",
        ring: "ring-light-blue/30",
        bg: "bg-light-blue/10",
        onClick: undefined as (() => void) | undefined,
    },
    {
        key: "kitchen",
        title: "Kitchen",
        tag: "Live display",
        blurb: "A big screen with every active ticket — start, mark ready, call served. No papers lost.",
        icon: FireIcon,
        accent: "text-dark-red",
        ring: "ring-dark-red/30",
        bg: "bg-dark-red/10",
        onClick: undefined as (() => void) | undefined,
    },
    {
        key: "manager",
        title: "Manager",
        tag: "Dashboard & money",
        blurb: "Real revenue, open orders, floor status, staff, and outstanding platform fees. 7/30 day views.",
        icon: ClipboardDocumentListIcon,
        accent: "text-emerald-500",
        ring: "ring-emerald-500/30",
        bg: "bg-emerald-500/10",
        onClick: undefined as (() => void) | undefined,
    },
];

/* ────────────────────────── Screen ────────────────────────── */

export function LandingScreen({ onEnterCustomer, onViewReservations, onStaffPortal, onKitchenDisplay, onManagerPortal }: Props) {
    const handlers = {
        customer: onEnterCustomer,
        waiter: onStaffPortal,
        kitchen: onKitchenDisplay,
        manager: onManagerPortal,
    };

    return (
        <main className="min-h-svh w-full bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                HERO — what this is about
              ═══════════════════════════════════════════════════════════ */}
            <div className="relative overflow-hidden bg-licorice px-5 pt-[max(env(safe-area-inset-top),24px)] pb-14">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-khaki mix-blend-screen blur-[90px] opacity-20" />
                    <div className="absolute bottom-0 -left-20 h-64 w-64 rounded-full bg-light-blue mix-blend-screen blur-[90px] opacity-15" />
                </div>

                <div className="relative z-10 mx-auto max-w-3xl">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-isabelline text-licorice shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
                            <span className="font-serif text-[17px] font-bold leading-none">V</span>
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-[14px] font-bold tracking-tight text-isabelline">Bysen</span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-isabelline/50">
                                Velvet Lounge · Accra
                            </span>
                        </div>
                    </div>

                    <h1 className="mt-8 text-[2.2rem] font-black leading-[1.05] tracking-[-0.04em] text-isabelline">
                        The whole venue
                        <br />
                        <span className="italic font-serif font-bold text-khaki">on one screen.</span>
                    </h1>
                    <p className="mt-4 max-w-[340px] text-[13.5px] leading-[1.6] tracking-tight text-isabelline/65">
                        Bysen is the QR-ordering + operations system for Velvet Lounge: guests order from their
                        phones, tickets hit the kitchen instantly, waiters settle on the floor, and the manager sees
                        every cedi in real time.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        {[
                            ["QR ordering", "no menu apps to install"],
                            ["Real-time kitchen", "live ticket display"],
                            ["Waiter PIN login", "no shared passwords"],
                            ["Platform fees", "flat ₵1–₵5 per sale"],
                        ].map(([k, v]) => (
                            <span
                                key={k}
                                className="inline-flex items-center gap-1.5 rounded-full border border-isabelline/15 bg-isabelline/5 px-3 py-1.5 text-[10px] font-semibold tracking-tight text-isabelline/80"
                            >
                                <span className="h-1 w-1 rounded-full bg-khaki" />
                                {k}
                                <span className="text-isabelline/40">·</span>
                                <span className="text-isabelline/50">{v}</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                PORTALS — choose where to go
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-8 pb-[max(env(safe-area-inset-bottom),28px)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-feldgrau">
                    Pick a doorway
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {PORTALS.map((p) => {
                        const Icon = p.icon;
                        return (
                            <button
                                key={p.key}
                                type="button"
                                onClick={handlers[p.key as keyof typeof handlers]}
                                className="group flex flex-col items-start rounded-3xl bg-white p-5 text-left shadow-[0_8px_24px_rgba(35,20,12,0.06)] ring-1 ring-isabelline transition-all duration-200 hover:shadow-[0_16px_40px_rgba(35,20,12,0.12)] hover:-translate-y-0.5 active:scale-[0.98]"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${p.bg}`}>
                                    <Icon className={`h-5 w-5 ${p.accent}`} />
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <h2 className="text-[16px] font-bold tracking-tight text-licorice">{p.title}</h2>
                                    <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ring-1 ${p.bg} ${p.accent}`}>
                                        {p.tag}
                                    </span>
                                </div>
                                <p className="mt-1.5 text-[11.5px] leading-[1.5] tracking-tight text-feldgrau">
                                    {p.blurb}
                                </p>
                                <span className={`mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] ${p.accent}`}>
                                    Enter
                                    <ArrowRightIcon className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                                </span>
                            </button>
                        );
                    })}
                </div>

                <p className="mt-6 text-center text-[10px] leading-relaxed text-feldgrau/60">
                    Tip: guests never see this page — a table QR goes straight to their menu.
                    <br />
                    <span className="inline-flex items-center gap-1">
                        <PhoneIcon className="h-3 w-3" /> Waiters/kitchen sign in with phone + PIN · manager uses
                        Supabase Auth
                    </span>
                </p>

                <button
                    type="button"
                    onClick={onViewReservations}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-licorice px-6 py-3.5 text-[12px] font-bold tracking-tight text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985]"
                >
                    <CalendarDaysIcon className="h-4 w-4" strokeWidth={2} />
                    Events & Reservations
                </button>
            </section>
        </main>
    );
}
