import { useCallback, useEffect, useState } from "react";
import {
    CheckIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    StarIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbCustomerProfile } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../hooks/useVenue";
import { PaginationBar } from "../../components/PaginationBar";
import clsx from "clsx";

type Tier = "VIP" | "Regular" | "New";

type CustomerRow = DbCustomerProfile & {
    tier: Tier;
    lastVisit: string;
};

const TIER_COLORS: Record<Tier, string> = {
    VIP: "bg-khaki text-licorice",
    Regular: "bg-feldgrau/15 text-feldgrau",
    New: "bg-light-blue/20 text-licorice",
};

const PAGE_SIZE = 20;

function relativeTime(iso: string): string {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return months >= 12 ? `${Math.floor(months / 12)}y ago` : `${months}mo ago`;
}

function tierOf(profile: DbCustomerProfile): Tier {
    if (profile.is_vip) return "VIP";
    if ((profile.total_visits ?? 0) <= 1) return "New";
    return "Regular";
}

/* ────────────────────────── Component ────────────────────────── */

export function CrmScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [customers, setCustomers] = useState<CustomerRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [tierFilter, setTierFilter] = useState<Tier | "All">("All");
    const [selected, setSelected] = useState<CustomerRow | null>(null);
    const [showCampaign, setShowCampaign] = useState(false);

    const fetchPage = useCallback(async (pageNo: number) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setLoading(true);
        try {
            const { data, error, total: totalCount } = await db.customersByVenue(venue.id, pageNo, PAGE_SIZE);
            if (error) throw error;
            setCustomers(
                (data ?? []).map((c) => ({
                    ...c,
                    tier: tierOf(c),
                    lastVisit: relativeTime(c.updated_at ?? c.created_at),
                })),
            );
            setTotal(totalCount ?? 0);
        } catch {
            toast.error("Could not load customers.");
        } finally {
            setLoading(false);
        }
    }, [venue.id]);

    useEffect(() => {
        fetchPage(0);
        setPage(0);
    }, [fetchPage]);

    const filtered = customers.filter((c) => {
        if (tierFilter !== "All" && c.tier !== tierFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return (
                (c.name ?? "").toLowerCase().includes(q) ||
                (c.phone ?? "").includes(q)
            );
        }
        return true;
    });

    const toggleVip = async (customer: CustomerRow) => {
        const next = !customer.is_vip;
        const { error } = await supabase
            .from("customer_profiles")
            .update({ is_vip: next, updated_at: new Date().toISOString() })
            .eq("id", customer.id);
        if (error) {
            toast.error("Could not update VIP status.");
            return;
        }
        setCustomers((prev) =>
            prev.map((c) =>
                c.id === customer.id
                    ? { ...c, is_vip: next, tier: next ? "VIP" : tierOf({ ...c, is_vip: next }) }
                    : c,
            ),
        );
        setSelected((prev) => (prev?.id === customer.id ? { ...prev, is_vip: next, tier: next ? "VIP" : "Regular" } : prev));
        toast.success(next ? `${customer.name ?? "Customer"} is now VIP.` : "VIP removed.");
    };

    /* ── Stats (real) ── */
    const totalCustomers = total;
    const vipCount = customers.filter((c) => c.tier === "VIP").length;
    const totalSpend = customers.reduce((s, c) => s + Number(c.total_spend), 0);
    const avgSpend = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
    const churnRisks = customers.filter((c) => c.lastVisit.startsWith("mo") || c.lastVisit.startsWith("y"));
    const newCustomers = customers.filter((c) => c.tier === "New");

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customers</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalCustomers}</p>
                </div>
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <HeartIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">VIP Members</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{vipCount}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Spend</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{formatGHS(totalSpend)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg / Customer</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{formatGHS(avgSpend)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">New Signups</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{newCustomers.length}</p>
                </div>
            </div>

            {/* ── Churn risk banner (this page) ── */}
            {churnRisks.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <StarIcon className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] tracking-tight text-licorice">
                            {churnRisks.length} customer{churnRisks.length > 1 ? "s" : ""} on this page haven't visited in months
                        </p>
                        <p className="text-[11px] text-feldgrau mt-0.5">
                            {churnRisks.slice(0, 3).map((c) => c.name ?? "Guest").join(", ")}{churnRisks.length > 3 ? ` +${churnRisks.length - 3} more` : ""} — consider sending a re-engagement offer
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCampaign(true)}
                        className="flex-shrink-0 rounded-full bg-licorice text-isabelline px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] hover:bg-licorice/90 transition-colors"
                    >
                        Send Offer &rarr;
                    </button>
                </div>
            )}

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
                                className={clsx(
                                    "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all",
                                    isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"
                                )}
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
                {loading ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                        <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Loading customers…</p>
                    </div>
                ) : (
                    <>
                        <table className="hidden md:table w-full">
                            <thead className="border-b border-isabelline bg-isabelline/50">
                                <tr className="text-left">
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customer</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Tier</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Visits</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Spend</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Avg/Visit</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Last Visit</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-isabelline">
                                {filtered.map((c) => {
                                    const visits = Math.max(1, c.total_visits);
                                    return (
                                        <tr
                                            key={c.id}
                                            className="cursor-pointer hover:bg-isabelline/30 transition-colors"
                                            onClick={() => setSelected(c)}
                                        >
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={clsx(
                                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                                                        c.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"
                                                    )}>
                                                        {(c.name ?? "Guest").charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{c.name ?? "Guest"}</p>
                                                        <p className="truncate text-[10px] tracking-tight text-feldgrau">{c.phone ?? "no phone"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                                    TIER_COLORS[c.tier]
                                                )}>
                                                    {c.tier === "VIP" && <StarIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                                                    {c.tier}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{c.total_visits}</td>
                                            <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(Number(c.total_spend))}</td>
                                            <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-feldgrau">{formatGHS(Math.round(Number(c.total_spend) / visits))}</td>
                                            <td className="px-4 py-2.5 text-[11px] tracking-tight text-feldgrau">{c.lastVisit}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleVip(c); }}
                                                    aria-label={c.tier === "VIP" ? "Remove VIP" : "Make VIP"}
                                                    className={clsx(
                                                        "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                                        c.tier === "VIP"
                                                            ? "bg-khaki/20 text-khaki hover:bg-khaki/30"
                                                            : "bg-isabelline text-feldgrau hover:bg-khaki/15 hover:text-khaki"
                                                    )}
                                                >
                                                    <HeartIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
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
                                    <div className={clsx(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                                        c.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"
                                    )}>
                                        {(c.name ?? "Guest").charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{c.name ?? "Guest"}</p>
                                            <span className={clsx("inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", TIER_COLORS[c.tier])}>
                                                {c.tier}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[10px] tracking-tight text-feldgrau">
                                            {c.total_visits} visits · {formatGHS(Number(c.total_spend))} · {c.lastVisit}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                                <p className="mt-3 text-[12px] font-bold tracking-tight text-licorice">No customers match your filters</p>
                            </div>
                        )}

                        <PaginationBar
                            page={page + 1}
                            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                            onPageChange={(p) => {
                                setPage(p - 1);
                                fetchPage(p - 1);
                            }}
                        />
                    </>
                )}
            </div>

            {/* ── Customer detail drawer ── */}
            {selected && (
                <CustomerDetailDrawer customer={selected} onClose={() => setSelected(null)} onToggleVip={toggleVip} />
            )}

            {/* ── Campaign modal ── */}
            {showCampaign && (
                <CampaignModal
                    venueId={venue.id}
                    vipCount={vipCount}
                    totalCount={totalCustomers}
                    onClose={() => setShowCampaign(false)}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOMER DETAIL DRAWER
   ═══════════════════════════════════════════════════════════════════════════ */

function CustomerDetailDrawer({ customer, onClose, onToggleVip }: {
    customer: CustomerRow;
    onClose: () => void;
    onToggleVip: (c: CustomerRow) => void;
}) {
    const avgPerVisit = Math.round(Number(customer.total_spend) / Math.max(1, customer.total_visits));

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Customer Profile</p>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-bold",
                            customer.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-isabelline text-feldgrau"
                        )}>
                            {(customer.name ?? "Guest").charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[16px] font-bold tracking-tight text-licorice">{customer.name ?? "Guest"}</h3>
                            <div className="mt-0.5 flex items-center gap-2">
                                <span className={clsx(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                    TIER_COLORS[customer.tier]
                                )}>
                                    {customer.tier === "VIP" && <StarIcon className="h-2.5 w-2.5" strokeWidth={2.5} />}
                                    {customer.tier}
                                </span>
                                <span className="text-[10px] tracking-tight text-feldgrau">{customer.phone ?? "no phone"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-isabelline p-3">
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{customer.total_visits}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Visits</p>
                        </div>
                        <div className="border-x border-licorice/8 text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{formatGHS(Number(customer.total_spend))}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Spend</p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-khaki">{formatGHS(avgPerVisit)}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Avg/Visit</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 text-[11px]">
                        {customer.email && (
                            <div className="flex justify-between border-b border-isabelline pb-1.5">
                                <span className="font-medium tracking-tight text-feldgrau">Email</span>
                                <span className="font-bold tracking-tight text-licorice">{customer.email}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Last Visit</span>
                            <span className="font-bold tracking-tight text-licorice">{customer.lastVisit}</span>
                        </div>
                        {customer.notes && (
                            <div className="rounded-lg bg-dark-red/8 px-3 py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-dark-red">Notes</p>
                                <p className="mt-0.5 text-[11px] tracking-tight text-licorice">{customer.notes}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => onToggleVip(customer)}
                            className={clsx(
                                "inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold tracking-tight transition-all active:scale-95",
                                customer.tier === "VIP" ? "bg-khaki/20 text-khaki" : "bg-licorice text-isabelline"
                            )}
                        >
                            <HeartIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            {customer.tier === "VIP" ? "Remove VIP" : "Make VIP"}
                        </button>
                        {customer.phone ? (
                            <button
                                type="button"
                                onClick={() => {
                                    const numbers = [customer.phone!.replace(/[^\d+]/g, "")];
                                    supabase
                                        .functions.invoke("mnotify-sms", {
                                            body: {
                                                action: "broadcast",
                                                recipients: numbers,
                                                message: "Hi from Bysen! A special offer is waiting for you at the venue. Reply STOP to opt out.",
                                            },
                                        })
                                        .then(() => toast.success("SMS sent."))
                                        .catch(() => toast.error("SMS failed — is the edge function deployed?"));
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-full bg-isabelline px-3 py-2 text-[10px] font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95"
                            >
                                <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Send SMS
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="inline-flex items-center justify-center gap-1 rounded-full bg-isabelline/60 px-3 py-2 text-[10px] font-bold tracking-tight text-feldgrau/50 ring-1 ring-licorice/8"
                            >
                                <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                No phone
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMPAIGN MODAL (real SMS via the mnotify edge function)
   ═══════════════════════════════════════════════════════════════════════════ */

function CampaignModal({ venueId, vipCount, totalCount, onClose }: {
    venueId: string;
    vipCount: number;
    totalCount: number;
    onClose: () => void;
}) {
    const [audience, setAudience] = useState<"vip" | "all">("vip");
    const [message, setMessage] = useState("Join us this weekend for live jazz and your favorite cocktails. We can't wait to see you! Reply STOP to opt out.");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sentCount, setSentCount] = useState(0);

    const recipientCount = audience === "vip" ? vipCount : totalCount;

    const handleSend = async () => {
        setSending(true);
        try {
            const { data } = await supabase
                .from("customer_profiles")
                .select("phone")
                .eq("venue_id", venueId)
                .not("phone", "is", null)
                .neq("phone", "");
            const rows = (data ?? []) as { phone: string | null }[];
            let phones = rows.map((r) => r.phone!).filter(Boolean);
            if (audience === "vip") {
                const { data: vipRows } = await supabase
                    .from("customer_profiles")
                    .select("phone")
                    .eq("venue_id", venueId)
                    .eq("is_vip", true)
                    .not("phone", "is", null)
                    .neq("phone", "");
                phones = (vipRows ?? []).map((r) => r.phone!).filter(Boolean);
            }
            phones = [...new Set(phones)];

            if (phones.length === 0) {
                toast.error("No phone numbers in this audience yet.");
                setSending(false);
                return;
            }

            const res = await supabase.functions.invoke("mnotify-sms", {
                body: { action: "broadcast", recipients: phones, message },
            });
            if (res.error) throw res.error;
            setSentCount(phones.length);
            setSent(true);
        } catch {
            toast.error("Campaign failed — is the mnotify edge function deployed?");
        } finally {
            setSending(false);
        }
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
                        SMS queued for {sentCount} {audience === "vip" ? "VIP members" : "customers"}.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-4 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline"
                    >
                        Done
                    </button>
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
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Audience</label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setAudience("vip")}
                                className={clsx("flex flex-col items-center gap-0.5 rounded-lg py-2.5 transition-all active:scale-95", audience === "vip" ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8")}>
                                <HeartIcon className="h-4 w-4" strokeWidth={2} />
                                <span className="text-[10px] font-bold tracking-tight">VIP only</span>
                                <span className="text-[9px] font-mono tabular-nums opacity-70">{vipCount}</span>
                            </button>
                            <button type="button" onClick={() => setAudience("all")}
                                className={clsx("flex flex-col items-center gap-0.5 rounded-lg py-2.5 transition-all active:scale-95", audience === "all" ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8")}>
                                <PaperAirplaneIcon className="h-4 w-4" strokeWidth={2} />
                                <span className="text-[10px] font-bold tracking-tight">All customers</span>
                                <span className="text-[9px] font-mono tabular-nums opacity-70">{totalCount}</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Message</label>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={160}
                            className="mt-1 w-full resize-none rounded-lg bg-isabelline px-3 py-2 text-[12px] leading-[1.5] text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        <div className="mt-1 flex items-center justify-between text-[9px] font-bold tracking-tight text-feldgrau">
                            <span>{message.length}/160 characters</span>
                            <span>{recipientCount} recipients</span>
                        </div>
                    </div>

                    <div className="rounded-lg bg-khaki/12 px-3 py-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold tracking-tight text-khaki">Estimated cost</span>
                            <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(recipientCount * 0.15)}</span>
                        </div>
                        <p className="mt-0.5 text-[9px] tracking-tight text-feldgrau">GHS 0.15 per SMS · via mnotify</p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-isabelline px-5 py-3">
                    <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">Cancel</button>
                    <button type="button" onClick={handleSend} disabled={!message.trim() || sending}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40">
                        {sending ? (
                            <>
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-isabelline/30 border-t-isabelline" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <PaperAirplaneIcon className="h-3.5 w-3.5" strokeWidth={2} /> Send to {recipientCount}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
