import { useState } from "react";
import {
    ArrowLeftIcon,
    CalendarDaysIcon,
    ClockIcon,
    MapPinIcon,
    PlusIcon,
    MinusIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatGHS } from "../data/menu";

/* ────────────────────────── Mock data ────────────────────────── */

type EventItem = {
    id: string;
    title: string;
    subtitle: string;
    date: string;
    dayLabel: string;
    image: string;
    price: number;
    category: "Music" | "Tasting" | "Special";
};

const EVENTS: EventItem[] = [
    {
        id: "jazz-trio",
        title: "The Velvet Trio",
        subtitle: "Live jazz — standards, bossa, originals",
        date: "Every Saturday · 9 PM",
        dayLabel: "SAT",
        image:
            "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80",
        price: 50,
        category: "Music",
    },
    {
        id: "dj-ama",
        title: "DJ Ama · Late Set",
        subtitle: "Afrohouse, soulful, deep — till 2 AM",
        date: "Every Friday · 11 PM",
        dayLabel: "FRI",
        image:
            "https://images.unsplash.com/photo-1571266028243-d220c6a7f1ef?auto=format&fit=crop&w=800&q=80",
        price: 80,
        category: "Music",
    },
    {
        id: "wine-tasting",
        title: "Sunday Wine Tasting",
        subtitle: "Five natural wines with Chef Ama's pairings",
        date: "Sundays · 4 PM",
        dayLabel: "SUN",
        image:
            "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=800&q=80",
        price: 120,
        category: "Tasting",
    },
];

type Ticket = {
    id: string;
    title: string;
    date: string;
    code: string;
    type: "Event" | "Reservation";
};

const MOCK_TICKETS: Ticket[] = [
    {
        id: "t-001",
        title: "The Velvet Trio",
        date: "Sat Jun 8 · 9:00 PM",
        code: "VL-8X4K2",
        type: "Event",
    },
    {
        id: "t-002",
        title: "Table for 4",
        date: "Sun Jun 9 · 7:00 PM",
        code: "VL-R9M3P",
        type: "Reservation",
    },
];

const TIME_SLOTS = [
    "6:00 PM",
    "6:30 PM",
    "7:00 PM",
    "7:30 PM",
    "8:00 PM",
    "8:30 PM",
    "9:00 PM",
    "9:30 PM",
    "10:00 PM",
];

const SEATING_AREAS = ["Window", "Bar", "Lounge", "VIP"] as const;

/* ────────────────────────── Date helpers ────────────────────────── */

function getNextDays(count: number): { label: string; date: string; iso: string }[] {
    const days: { label: string; date: string; iso: string }[] = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push({
            label: d.toLocaleDateString("en-GH", { weekday: "short" }).toUpperCase(),
            date: d.getDate().toString(),
            iso: d.toISOString().split("T")[0],
        });
    }
    return days;
}

/* ────────────────────────── QR placeholder ────────────────────────── */

function QrPlaceholder({ size = 120 }: { size?: number }) {
    // Simple visual QR-like grid using CSS
    const cells = 11;
    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-lg bg-white p-2 ring-1 ring-licorice/10"
            style={{ width: size, height: size }}
        >
            <div
                className="grid h-full w-full"
                style={{ gridTemplateColumns: `repeat(${cells}, 1fr)` }}
            >
                {Array.from({ length: cells * cells }).map((_, i) => {
                    // Deterministic pseudo-random pattern based on index
                    const filled = ((i * 7 + 13) % 11) % 3 !== 0;
                    const row = Math.floor(i / cells);
                    const col = i % cells;
                    // Corner markers
                    const isCorner =
                        (row < 3 && col < 3) ||
                        (row < 3 && col >= cells - 3) ||
                        (row >= cells - 3 && col < 3);
                    const isCornerEdge =
                        isCorner &&
                        (row === 0 || row === 2 || col === 0 || col === 2 ||
                            row === cells - 1 || row === cells - 3 ||
                            col === cells - 1 || col === cells - 3);
                    return (
                        <div
                            key={i}
                            className={
                                isCorner
                                    ? isCornerEdge
                                        ? "bg-licorice"
                                        : "bg-transparent"
                                    : filled
                                        ? "bg-licorice"
                                        : "bg-transparent"
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

type Tab = "events" | "reserve" | "tickets";

type Props = {
    onBack: () => void;
};

export function ReservationsScreen({ onBack }: Props) {
    const [tab, setTab] = useState<Tab>("events");
    const [selectedDate, setSelectedDate] = useState(getNextDays(7)[0].iso);
    const [selectedTime, setSelectedTime] = useState("7:00 PM");
    const [partySize, setPartySize] = useState(2);
    const [seating, setSeating] = useState<(typeof SEATING_AREAS)[number]>("Window");
    const [reserved, setReserved] = useState(false);

    const days = getNextDays(7);

    const handleReserve = () => {
        setReserved(true);
        window.setTimeout(() => setReserved(false), 3000);
    };

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            Reservations
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            Velvet Lounge
                        </span>
                    </div>

                    <div className="w-9" />
                </div>

                {/* Tab bar */}
                <nav className="mx-auto w-full max-w-3xl px-5 md:px-8 pb-3">
                    <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-licorice/8">
                        {(
                            [
                                { id: "events", label: "Events" },
                                { id: "reserve", label: "Reserve" },
                                { id: "tickets", label: "My Tickets" },
                            ] as { id: Tab; label: string }[]
                        ).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`flex-1 rounded-full py-2 text-[12px] font-bold tracking-tight transition-all duration-200 ${tab === t.id
                                    ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                    : "text-feldgrau hover:text-licorice"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl px-5 md:px-8 pt-6 pb-[calc(60px+env(safe-area-inset-bottom))]">
                {/* ── EVENTS TAB ── */}
                {tab === "events" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                What's On
                            </p>
                            <h1 className="mt-1.5 text-[1.75rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                Upcoming
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    nights & events
                                </span>
                            </h1>
                        </div>

                        <div className="flex flex-col gap-4">
                            {EVENTS.map((event, idx) => (
                                <article
                                    key={event.id}
                                    className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline"
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                >
                                    <div className="relative h-40 w-full overflow-hidden">
                                        <img
                                            src={event.image}
                                            alt={event.title}
                                            className="h-full w-full object-cover"
                                        />
                                        <div
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-gradient-to-t from-licorice/60 via-transparent to-transparent"
                                        />
                                        <div className="absolute right-3 top-3">
                                            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 backdrop-blur-md text-[9px] font-bold uppercase tracking-[0.14em] text-licorice ring-1 ring-white/70">
                                                {event.category}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-3 left-3 right-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                                {event.dayLabel} · {event.date.split(" · ")[1] ?? event.date}
                                            </p>
                                            <h3 className="mt-0.5 font-serif text-[18px] font-bold italic leading-tight tracking-[-0.02em] text-isabelline">
                                                {event.title}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                            {event.subtitle}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-[15px] font-bold tabular-nums text-licorice">
                                                {formatGHS(event.price)}
                                            </span>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] transition-all hover:bg-licorice/95 active:scale-95"
                                            >
                                                Get Tickets
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── RESERVE TAB ── */}
                {tab === "reserve" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                Book a Table
                            </p>
                            <h1 className="mt-1.5 text-[1.75rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                Reserve your
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    corner of the lounge
                                </span>
                            </h1>
                        </div>

                        {/* Date selector */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <CalendarDaysIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Choose a date
                                </span>
                            </div>
                            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                                {days.map((day) => {
                                    const isActive = day.iso === selectedDate;
                                    return (
                                        <button
                                            key={day.iso}
                                            type="button"
                                            onClick={() => setSelectedDate(day.iso)}
                                            className={`
                                                flex w-14 shrink-0 flex-col items-center rounded-xl py-2.5
                                                transition-all duration-150 active:scale-95
                                                ${isActive
                                                    ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                    : "bg-isabelline text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                                }
                                            `}
                                        >
                                            <span className="text-[9px] font-bold uppercase tracking-wider">
                                                {day.label}
                                            </span>
                                            <span className="mt-0.5 font-serif text-[18px] font-bold leading-none">
                                                {day.date}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time selector */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Time
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {TIME_SLOTS.map((time) => {
                                    const isActive = time === selectedTime;
                                    return (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => setSelectedTime(time)}
                                            className={`
                                                rounded-full px-3 py-1.5 text-[11px] font-bold tracking-tight
                                                transition-all duration-150 active:scale-95
                                                ${isActive
                                                    ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                    : "bg-isabelline text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                                }
                                            `}
                                        >
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Party size */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserGroupIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                    <span className="text-[12px] font-bold tracking-tight text-licorice">
                                        Party size
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 rounded-full bg-isabelline p-1">
                                    <button
                                        type="button"
                                        onClick={() => setPartySize((s) => Math.max(1, s - 1))}
                                        disabled={partySize <= 1}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-licorice shadow-sm transition-all active:scale-90 disabled:opacity-30"
                                    >
                                        <MinusIcon className="h-3 w-3" strokeWidth={2.5} />
                                    </button>
                                    <span className="w-6 text-center font-mono text-[13px] font-bold tabular-nums text-licorice">
                                        {partySize}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPartySize((s) => Math.min(12, s + 1))}
                                        disabled={partySize >= 12}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-licorice text-isabelline transition-all active:scale-90 disabled:opacity-30"
                                    >
                                        <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Seating area */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <MapPinIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Seating area
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {SEATING_AREAS.map((area) => {
                                    const isActive = area === seating;
                                    return (
                                        <button
                                            key={area}
                                            type="button"
                                            onClick={() => setSeating(area)}
                                            className={`
                                                rounded-xl py-2.5 text-[12px] font-bold tracking-tight
                                                transition-all duration-150 active:scale-95
                                                ${isActive
                                                    ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                    : "bg-isabelline text-feldgrau ring-1 ring-licorice/8 hover:text-licorice"
                                                }
                                            `}
                                        >
                                            {area}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Reserve button */}
                        <button
                            type="button"
                            onClick={handleReserve}
                            disabled={reserved}
                            className={`
                                flex w-full items-center justify-center gap-2 rounded-full py-3.5
                                text-[13px] font-bold tracking-tight transition-all duration-200
                                active:scale-[0.985]
                                ${reserved
                                    ? "bg-khaki/20 text-khaki"
                                    : "bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95"
                                }
                            `}
                        >
                            {reserved ? (
                                <>
                                    <CheckCircleIcon className="h-4 w-4" strokeWidth={2} />
                                    Reservation confirmed — check My Tickets
                                </>
                            ) : (
                                <>Reserve Table</>
                            )}
                        </button>
                    </div>
                )}

                {/* ── MY TICKETS TAB ── */}
                {tab === "tickets" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                                Your Bookings
                            </p>
                            <h1 className="mt-1.5 text-[1.75rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                                Tickets &
                                <br />
                                <span className="italic font-serif font-bold text-khaki">
                                    reservations
                                </span>
                            </h1>
                        </div>

                        {MOCK_TICKETS.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {MOCK_TICKETS.map((ticket, idx) => (
                                    <div
                                        key={ticket.id}
                                        className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline"
                                        style={{ animationDelay: `${idx * 60}ms` }}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between border-b border-isabelline px-4 py-3">
                                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-khaki">
                                                {ticket.type}
                                            </span>
                                            <span className="font-mono text-[10px] font-bold tabular-nums text-feldgrau">
                                                {ticket.code}
                                            </span>
                                        </div>

                                        {/* Body */}
                                        <div className="flex items-center gap-4 p-4">
                                            <QrPlaceholder size={88} />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-serif text-[16px] font-bold italic leading-tight tracking-[-0.02em] text-licorice">
                                                    {ticket.title}
                                                </h3>
                                                <p className="mt-1 text-[11px] font-medium tracking-tight text-feldgrau">
                                                    {ticket.date}
                                                </p>
                                                <p className="mt-2 text-[10px] font-semibold tracking-tight text-khaki">
                                                    Show at entry
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                                <span className="h-1.5 w-1.5 rounded-full bg-khaki" />
                                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                                    No tickets yet
                                </h3>
                                <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                    Browse events or reserve a table to get started.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
