import { useState } from "react";
import {
    CheckIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    StarIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";

/* ────────────────────────── Types & mock data ────────────────────────── */

type Tier = "VIP" | "Regular" | "New";

type Customer = {
    id: string;
    name: string;
    phone: string;
    email?: string;
    tier: Tier;
    visits: number;
    totalSpend: number;
    lastVisit: string;
    favoriteItem?: string;
    notes?: string;
};

const MOCK_CUSTOMERS: Customer[] = [
    { id: "c1", name: "Nana Kwame", phone: "+233 24 100 1001", email: "nana@email.com", tier: "VIP", visits: 42, totalSpend: 12400, lastVisit: "2 days ago", favoriteItem: "Velvet Old Fashioned", notes: "Allergy: nuts. Prefers window seat." },
    { id: "c2", name: "Adwoa Asantewaa", phone: "+233 24 100 1002", email: "adwoa@email.com", tier: "VIP", visits: 38, totalSpend: 9800, lastVisit: "1 week ago", favoriteItem: "Cocoa Espresso Martini" },
    { id: "c3", name: "Kofi Asare", phone: "+233 26 100 1003", tier: "Regular", visits: 18, totalSpend: 4200, lastVisit: "3 days ago", favoriteItem: "Lamb Suya Skewers" },
    { id: "c4", name: "Ama Darko", phone: "+233 24 100 1004", tier: "Regular", visits: 12, totalSpend: 2800, lastVisit: "2 weeks ago" },
    { id: "c5", name: "Kojo Frempong", phone: "+233 27 100 1005", tier: "New", visits: 2, totalSpend: 480, lastVisit: "Yesterday" },
    { id: "c6", name: "Esi Mensah", phone: "+233 24 100 1006", email: "esi@email.com", tier: "Regular", visits: 24, totalSpend: 5600, lastVisit: "5 days ago", favoriteItem: "Hibiscus Spritz" },
    { id: "c7", name: "Yaw Owusu", phone: "+233 26 100 1007", tier: "New", visits: 1, totalSpend: 220, lastVisit: "1 month ago" },
];

const TIER_COLORS: Record<Tier, string> = {
    VIP: "bg-khaki text-licorice",
    Regular: "bg-feldgrau/15 text-feldgrau",
    New: "bg-light-blue/20 text-licorice",
};

/* ────────────────────────── Component ────────────────────────── */

export function CrmScreen() {
    const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
    const [search, setSearch] = useState("");
    const [tierFilter, setTierFilter] = useState<Tier | "All">("All");
    const [selected, setSelected] = useState<Customer | null>(null);
    const [showCampaign, setShowCampaign] = useState(false);

    const filtered = customers.filter((c) => {
        if (tierFilter !== "All" && c.tier !== tierFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return c.name.toLowerCase().includes(q) || c.phone.includes(q);
        }
        return true;
    });

    const toggleVip = (id: string) => {
        setCustomers((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, tier: c.tier === "VIP" ? "Regular" : "VIP" } : c
            )
        );
    };

    /* ── Stats ── */
    const totalCustomers = customers.length;
    const vipCount = customers.filter((c) => c.tier === "VIP").length;
    const totalSpend = customers.reduce((s, c) => s + c.totalSpend, 0);
    const avgSpend = totalSpend / totalCustomers;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customers</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalCustomers}</p>
                </div>
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <HeartIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">VIP Members</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-khaki">{vipCount}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Lifetime Spend</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{formatGHS(totalSpend)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg Spend / Customer</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{formatGHS(avgSpend)}</p>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or phone…"
                        className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                    />
                </div>

                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    {(["All", "VIP", "Regular", "New"] as const).map((t) => {
                        const isActive = t === tierFilter;
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTierFilter(t)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all ${isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"}`}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => setShowCampaign(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95"
                >
                    <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    New Campaign
                </button>
            </div>

            {/* ── Customer table ── */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                <table className="hidden md:table w-full">
                    <thead className="border-b border-isabelline bg-isabelline/50">
                        <tr className="text-left">
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customer</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Tier</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Visits</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Spend</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Last Visit</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline">
                        {filtered.map((c) => (
                            <tr
                                key={c.id}
                                className="cursor-pointer hover:bg-isabelline/30 transition-colors"
                                onClick={() => setSelected(c)}
                            >
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${c.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"}`}>
                                            {c.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{c.name}</p>
                                            <p className="truncate text-[10px] tracking-tight text-feldgrau">{c.phone}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TIER_COLORS[c.tier]}`}>
                                        {c.tier === "VIP" && <StarIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                                        {c.tier}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{c.visits}</td>
                                <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(c.totalSpend)}</td>
                                <td className="px-4 py-2.5 text-[11px] tracking-tight text-feldgrau">{c.lastVisit}</td>
                                <td className="px-4 py-2.5 text-right">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleVip(c.id);
                                        }}
                                        aria-label={c.tier === "VIP" ? "Remove VIP" : "Make VIP"}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${c.tier === "VIP" ? "bg-khaki/20 text-khaki hover:bg-khaki/30" : "bg-isabelline text-feldgrau hover:bg-khaki/15 hover:text-khaki"}`}
                                    >
                                        <HeartIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-isabelline">
                    {filtered.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelected(c)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-isabelline/50"
                        >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${c.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"}`}>
                                {c.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{c.name}</p>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${TIER_COLORS[c.tier]}`}>
                                        {c.tier}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[10px] tracking-tight text-feldgrau">
                                    {c.visits} visits · {formatGHS(c.totalSpend)} · {c.lastVisit}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Customer detail drawer ── */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center">
                    <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
                    <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customer Profile</p>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                            >
                                <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-bold ${selected.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"}`}>
                                    {selected.name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-[16px] font-bold tracking-tight text-licorice">{selected.name}</h3>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TIER_COLORS[selected.tier]}`}>
                                            {selected.tier === "VIP" && <StarIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                                            {selected.tier}
                                        </span>
                                        <span className="text-[10px] tracking-tight text-feldgrau">{selected.phone}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-isabelline p-3">
                                <div className="text-center">
                                    <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{selected.visits}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Visits</p>
                                </div>
                                <div className="border-x border-licorice/8 text-center">
                                    <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{formatGHS(selected.totalSpend)}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Spend</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-[16px] font-black tabular-nums text-khaki">{formatGHS(Math.round(selected.totalSpend / selected.visits))}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Avg/Visit</p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="mt-4 space-y-2 text-[11px]">
                                {selected.email && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Email</span>
                                        <span className="font-bold tracking-tight text-licorice">{selected.email}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-isabelline pb-1.5">
                                    <span className="font-medium tracking-tight text-feldgrau">Last Visit</span>
                                    <span className="font-bold tracking-tight text-licorice">{selected.lastVisit}</span>
                                </div>
                                {selected.favoriteItem && (
                                    <div className="flex justify-between border-b border-isabelline pb-1.5">
                                        <span className="font-medium tracking-tight text-feldgrau">Favorite</span>
                                        <span className="font-bold tracking-tight text-licorice">{selected.favoriteItem}</span>
                                    </div>
                                )}
                                {selected.notes && (
                                    <div className="rounded-lg bg-dark-red/8 px-3 py-2">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-dark-red">Notes</p>
                                        <p className="mt-0.5 text-[11px] tracking-tight text-licorice">{selected.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        toggleVip(selected.id);
                                        setSelected({ ...selected, tier: selected.tier === "VIP" ? "Regular" : "VIP" });
                                    }}
                                    className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold tracking-tight transition-all active:scale-95 ${selected.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-licorice text-isabelline"}`}
                                >
                                    <HeartIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                    {selected.tier === "VIP" ? "Remove VIP" : "Make VIP"}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center gap-1 rounded-full bg-isabelline px-3 py-2 text-[10px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95"
                                >
                                    <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                    Send SMS
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Campaign modal ── */}
            {showCampaign && (
                <CampaignModal
                    vipCount={vipCount}
                    totalCount={totalCustomers}
                    onClose={() => setShowCampaign(false)}
                />
            )}
        </div>
    );
}

/* ────────────────────────── Campaign Modal ────────────────────────── */

type CampaignProps = {
    vipCount: number;
    totalCount: number;
    onClose: () => void;
};

function CampaignModal({ vipCount, totalCount, onClose }: CampaignProps) {
    const [audience, setAudience] = useState<"vip" | "all">("vip");
    const [message, setMessage] = useState("Hi from Velvet Lounge! Join us this Friday for live jazz and your favorite Velvet Old Fashioned. Reply STOP to opt out.");
    const [sent, setSent] = useState(false);

    const recipientCount = audience === "vip" ? vipCount : totalCount;

    const handleSend = () => {
        setSent(true);
        window.setTimeout(() => {
            onClose();
        }, 1800);
    };

    if (sent) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" />
                <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-khaki/15">
                        <CheckIcon className="h-7 w-7 text-khaki" strokeWidth={2.5} />
                    </div>
                    <h3 className="mt-4 text-[18px] font-bold tracking-tight text-licorice">Campaign sent</h3>
                    <p className="mt-1 text-[12px] tracking-tight text-feldgrau">
                        SMS delivered to {recipientCount} {audience === "vip" ? "VIP members" : "customers"}.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">SMS Campaign</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">Reach your customers</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                    >
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    {/* Audience */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Audience</label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setAudience("vip")}
                                className={`flex flex-col items-center gap-0.5 rounded-lg py-2.5 transition-all active:scale-95 ${audience === "vip" ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8"}`}
                            >
                                <HeartIcon className="h-4 w-4" strokeWidth={2} />
                                <span className="text-[10px] font-bold tracking-tight">VIP only</span>
                                <span className="text-[9px] font-mono tabular-nums opacity-70">{vipCount}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAudience("all")}
                                className={`flex flex-col items-center gap-0.5 rounded-lg py-2.5 transition-all active:scale-95 ${audience === "all" ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8"}`}
                            >
                                <PaperAirplaneIcon className="h-4 w-4" strokeWidth={2} />
                                <span className="text-[10px] font-bold tracking-tight">All customers</span>
                                <span className="text-[9px] font-mono tabular-nums opacity-70">{totalCount}</span>
                            </button>
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            maxLength={160}
                            className="mt-1 w-full resize-none rounded-lg bg-isabelline px-3 py-2 text-[12px] leading-[1.5] text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                        <div className="mt-1 flex items-center justify-between text-[9px] font-bold tracking-tight text-feldgrau">
                            <span>{message.length}/160 characters</span>
                            <span>{recipientCount} recipients</span>
                        </div>
                    </div>

                    {/* Cost estimate */}
                    <div className="rounded-lg bg-khaki/12 px-3 py-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-khaki">Estimated cost</span>
                            <span className="font-mono font-bold tabular-nums text-licorice">
                                {formatGHS(recipientCount * 0.15)}
                            </span>
                        </div>
                        <p className="mt-0.5 text-[9px] tracking-tight text-feldgrau">GHS 0.15 per SMS · via Hubtel</p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-isabelline px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        Send to {recipientCount}
                    </button>
                </div>
            </div>
        </div>
    );
}
