import { useEffect, useRef, useState } from "react";
import {
    ArrowLeftIcon,
    CalendarDaysIcon,
    ClockIcon,
    MapPinIcon,
    PhoneIcon,
    PlusIcon,
    MinusIcon,
    UserGroupIcon,
    UserIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import QRCode from "qrcode";
import { formatGHS } from "../data/menu";
import { db } from "../lib/api";
import { useVenue } from "../hooks/useVenue";

const PHONE_KEY = "nightos:res-phone";

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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
    pending: { text: "Pending", cls: "bg-amber-100 text-amber-700" },
    confirmed: { text: "Confirmed", cls: "bg-emerald-100 text-emerald-700" },
    seated: { text: "Seated", cls: "bg-sky-100 text-sky-700" },
    cancelled: { text: "Cancelled", cls: "bg-rose-100 text-rose-700" },
    no_show: { text: "No show", cls: "bg-rose-100 text-rose-700" },
};

type TicketRow = {
    id: string;
    customer_name: string;
    guest_count: number;
    seating_area: string | null;
    reservation_date: string;
    reservation_time: string;
    status: string;
    created_at: string;
};

function to24h(time12: string): string {
    const [hm, ampm] = time12.split(" ");
    const [h, m] = hm.split(":").map(Number);
    let hour = h;
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/* ────────────────────────── Real QR code ────────────────────────── */

function RealQr({ value, size = 88 }: { value: string; size?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        QRCode.toCanvas(ref.current, value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: "M",
        }).catch(() => {});
    }, [value, size]);
    return (
        <div
            className="shrink-0 overflow-hidden rounded-lg bg-white p-1.5 ring-1 ring-licorice/10"
            style={{ width: size, height: size }}
        >
            <canvas ref={ref} className="h-full w-full" />
        </div>
    );
}

/* ────────────────────────── Component ────────────────────────── */

type Tab = "events" | "reserve" | "tickets";

type Props = {
    onBack: () => void;
};

export function ReservationsScreen({ onBack }: Props) {
    const { venue } = useVenue("velvet-lounge");
    const [tab, setTab] = useState<Tab>("events");
    const [selectedDate, setSelectedDate] = useState(getNextDays(7)[0].iso);
    const [selectedTime, setSelectedTime] = useState("7:00 PM");
    const [partySize, setPartySize] = useState(2);
    const [seating, setSeating] = useState<(typeof SEATING_AREAS)[number]>("Window");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [reserved, setReserved] = useState(false);

    const [events, setEvents] = useState<
        { id: string; event_name: string; event_date: string; event_time: string; ticket_type: string; price: number; description: string | null }[]
    >([]);
    const [eventsError, setEventsError] = useState<string | null>(null);

    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [ticketPhone, setTicketPhone] = useState("");
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketsError, setTicketsError] = useState<string | null>(null);

    const days = getNextDays(7);

    useEffect(() => {
        if (!venue) return;
        db.eventTickets(venue.id).then(({ data, error }) => {
            if (error) setEventsError(error.message);
            else setEvents(data ?? []);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [venue?.id]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(PHONE_KEY);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (saved) setTicketPhone(saved);
        // eslint-disable-next-line no-empty
        } catch {}
    }, []);

    const loadTickets = async (rawPhone?: string) => {
        const target = rawPhone ?? ticketPhone;
        if (target.trim().length < 9) {
            setTicketsError("Enter the phone number you booked with.");
            setTickets([]);
            return;
        }
        setTicketsLoading(true);
        setTicketsError(null);
        const { data, error } = await db.reservationsByPhone(target.trim());
        if (error) {
            setTicketsError(error.message);
        } else {
            setTickets(data ?? []);
            if ((data ?? []).length === 0) {
                setTicketsError("No reservations found for this number yet.");
            }
        }
        setTicketsLoading(false);
    };

    const handleReserve = async () => {
        if (!venue) return;
        setFormError(null);
        if (name.trim().length < 2) {
            setFormError("Please enter your name.");
            return;
        }
        if (phone.trim().length < 9) {
            setFormError("Please enter a valid phone number.");
            return;
        }
        setSubmitting(true);
        const { error } = await db.createReservation(
            venue.id,
            name.trim(),
            partySize,
            selectedDate,
            to24h(selectedTime),
            phone.trim(),
            undefined,
            `Seating: ${seating}`,
        );
        setSubmitting(false);
        if (error) {
            setFormError(error.message);
            return;
        }
        try {
            localStorage.setItem(PHONE_KEY, phone.trim());
        // eslint-disable-next-line no-empty
        } catch {}
        setTicketPhone(phone.trim());
        setReserved(true);
        window.setTimeout(() => {
            setReserved(false);
            setTab("tickets");
            loadTickets(phone.trim());
        }, 1600);
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
                            {venue?.name ?? "Velvet Lounge"}
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

                        {eventsError && (
                            <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                                <p className="text-[12px] font-bold text-licorice">{eventsError}</p>
                            </div>
                        )}

                        {!eventsError && events.length === 0 && (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                                <span className="h-1.5 w-1.5 rounded-full bg-khaki" />
                                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                                    No events listed yet
                                </h3>
                                <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                    Check back soon — or reserve a table now.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            {events.map((event, idx) => (
                                <article
                                    key={event.id}
                                    className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline"
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                >
                                    <div className="relative h-40 w-full overflow-hidden bg-licorice">
                                        <div
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-gradient-to-br from-licorice via-licorice/90 to-khaki/40"
                                        />
                                        <div className="absolute right-3 top-3">
                                            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 backdrop-blur-md text-[9px] font-bold uppercase tracking-[0.14em] text-licorice ring-1 ring-white/70">
                                                {event.ticket_type}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-3 left-3 right-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                                {formatDateLong(event.event_date)} · {formatTimeShort(event.event_time)}
                                            </p>
                                            <h3 className="mt-0.5 font-serif text-[18px] font-bold italic leading-tight tracking-[-0.02em] text-isabelline">
                                                {event.event_name}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                                            {event.description ?? "Join us for this event."}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-[15px] font-bold tabular-nums text-licorice">
                                                {formatGHS(event.price)}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau">
                                                Tickets at the venue
                                            </span>
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

                        {reserved && (
                            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
                                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
                                <p className="text-[12px] font-bold tracking-tight text-emerald-800">
                                    Reservation sent — the team will confirm it shortly.
                                </p>
                            </div>
                        )}

                        {/* Contact details */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Your details
                                </span>
                            </div>
                            <div className="mt-3 flex flex-col gap-2.5">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Full name"
                                    className="rounded-xl bg-isabelline px-4 py-2.5 text-[12px] font-semibold tracking-tight text-licorice placeholder:text-feldgrau/60 outline-none ring-1 ring-transparent focus:ring-khaki"
                                />
                                <div className="relative">
                                    <PhoneIcon className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-feldgrau" strokeWidth={2} />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Phone (e.g. 0541234567)"
                                        className="w-full rounded-xl bg-isabelline py-2.5 pl-10 pr-4 text-[12px] font-semibold tracking-tight text-licorice placeholder:text-feldgrau/60 outline-none ring-1 ring-transparent focus:ring-khaki"
                                    />
                                </div>
                            </div>
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

                        {formError && (
                            <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2.5 text-[11px] font-bold tracking-tight text-rose-700 ring-1 ring-rose-200">
                                {formError}
                            </p>
                        )}

                        {/* Reserve button */}
                        <button
                            type="button"
                            onClick={handleReserve}
                            disabled={submitting || reserved}
                            className={`
                                flex w-full items-center justify-center gap-2 rounded-full py-3.5
                                text-[13px] font-bold tracking-tight transition-all duration-200
                                active:scale-[0.985]
                                ${submitting || reserved
                                    ? "bg-khaki/20 text-khaki"
                                    : "bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95"
                                }
                            `}
                        >
                            {submitting ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-khaki border-t-transparent" />
                                    Sending…
                                </>
                            ) : reserved ? (
                                <>
                                    <CheckCircleIcon className="h-4 w-4" strokeWidth={2} />
                                    Reservation sent — check My Tickets
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

                        {/* Phone lookup */}
                        <div className="mb-4 flex gap-2 rounded-2xl bg-white p-3 shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                            <div className="relative flex-1">
                                <PhoneIcon className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-feldgrau" strokeWidth={2} />
                                <input
                                    type="tel"
                                    value={ticketPhone}
                                    onChange={(e) => setTicketPhone(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") loadTickets(); }}
                                    placeholder="Your phone number"
                                    className="w-full rounded-xl bg-isabelline py-2.5 pl-10 pr-4 text-[12px] font-semibold tracking-tight text-licorice placeholder:text-feldgrau/60 outline-none ring-1 ring-transparent focus:ring-khaki"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => loadTickets()}
                                disabled={ticketsLoading}
                                className="rounded-xl bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline active:scale-95 disabled:opacity-50"
                            >
                                {ticketsLoading ? "…" : "Load"}
                            </button>
                        </div>

                        {ticketsError && !ticketsLoading && (
                            <div className="mb-4 rounded-2xl bg-white px-6 py-5 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                                <p className="text-[12px] font-bold tracking-tight text-feldgrau">{ticketsError}</p>
                            </div>
                        )}

                        {tickets.length > 0 && (
                            <div className="flex flex-col gap-3">
                                {tickets.map((ticket, idx) => (
                                    <div
                                        key={ticket.id}
                                        className="animate-velvet-rise overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(35,20,12,0.06)] ring-1 ring-isabelline"
                                        style={{ animationDelay: `${idx * 60}ms` }}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between border-b border-isabelline px-4 py-3">
                                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-khaki">
                                                Reservation
                                            </span>
                                            <span className="font-mono text-[10px] font-bold tabular-nums text-feldgrau">
                                                {ticket.id.slice(0, 8).toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Body */}
                                        <div className="flex items-center gap-4 p-4">
                                            <RealQr value={`velvet://reservation/${ticket.id}`} />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-serif text-[16px] font-bold italic leading-tight tracking-[-0.02em] text-licorice">
                                                    {ticket.customer_name}
                                                </h3>
                                                <p className="mt-1 text-[11px] font-medium tracking-tight text-feldgrau">
                                                    {formatDateLong(ticket.reservation_date)} · {formatTimeShort(ticket.reservation_time)}
                                                    {ticket.seating_area ? ` · ${ticket.seating_area}` : ""}
                                                </p>
                                                <p className="mt-0.5 text-[11px] font-medium tracking-tight text-feldgrau">
                                                    {ticket.guest_count} {ticket.guest_count === 1 ? "guest" : "guests"}
                                                </p>
                                                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${STATUS_LABEL[ticket.status]?.cls ?? "bg-isabelline text-feldgrau"}`}>
                                                    {STATUS_LABEL[ticket.status]?.text ?? ticket.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}

function formatDateLong(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" });
}

function formatTimeShort(time: string): string {
    const [h, m] = time.slice(0, 5).split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}
