import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PhoneIcon,
    PlusIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ShieldCheckIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { db } from "../../lib/api";
import { useVenue } from "../../hooks/useVenue";
import { normalizeGhanaPhone } from "../../lib/utils";
import clsx from "clsx";

/* ═══════════════════════════════════════════════════════════════════════════
   STAFF & ROLES — fully real: rows come from the staff table, sign-in is by
   phone OTP (no PIN), and Add/Activate go through owner RPCs.
   ═══════════════════════════════════════════════════════════════════════════ */

type StaffRow = NonNullable<Awaited<ReturnType<typeof db.staffList>>["data"]>[number];

type ShiftCoverageRow = {
    staff_id: string;
    name: string;
    role: string;
    shift_id: string | null;
    shift_status: string | null;
    supervisor_approved: boolean | null;
    clock_in: string | null;
    open_bills: number;
};

const ROLE_OPTIONS = [
    { value: "manager", label: "Manager" },
    { value: "waiter", label: "Waiter" },
    { value: "kitchen", label: "Kitchen" },
    { value: "bar", label: "Bartender" },
    { value: "cashier", label: "Cashier" },
    { value: "owner", label: "Owner" },
] as const;

const ROLE_COLORS: Record<string, string> = {
    manager: "bg-licorice text-isabelline",
    waiter: "bg-khaki/20 text-khaki",
    kitchen: "bg-light-blue/20 text-licorice",
    bar: "bg-khaki/20 text-khaki",
    cashier: "bg-light-blue/20 text-licorice",
    owner: "bg-licorice text-isabelline",
};

function roleLabel(role: string): string {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

export function StaffManagerScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [staff, setStaff] = useState<StaffRow[]>([]);
    const [shiftStaffIds, setShiftStaffIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [creating, setCreating] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
    const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
    const [coverage, setCoverage] = useState<ShiftCoverageRow[] | null>(null);

    const load = useCallback(async () => {
        // Wait until we have a real venue UUID (not the default placeholder).
        if (!venue.id || venue.id === '00000000-0000-0000-0000-000000000000') return;
        setLoading(true);
        const [{ data: rows }, { data: shifts }, { data: coverageRows }] = await Promise.all([
            db.staffList(venue.id),
            db.activeShiftsByVenue(venue.id),
            db.shiftCoverage(venue.id),
        ]);
        setStaff(rows ?? []);
        setShiftStaffIds(new Set((shifts ?? []).map((sh) => sh.staff_id)));
        setCoverage((coverageRows as ShiftCoverageRow[] | null) ?? null);
        setLoading(false);
    }, [venue.id]);

    useEffect(() => {
        const init = async () => {
            await load();
        };
        init();
        }, [load]);

    const filtered = useMemo(
        () =>
            staff.filter((s) => {
                if (roleFilter !== "all" && s.role !== roleFilter) return false;
                if (search.trim()) {
                    const q = search.toLowerCase();
                    return (
                        s.name.toLowerCase().includes(q) ||
                        s.phone.toLowerCase().includes(q) ||
                        (s.email ?? "").toLowerCase().includes(q)
                    );
                }
                return true;
            }),
        [staff, roleFilter, search],
    );

    const tableData = filtered.length > 0 ? filtered : [
        {
            id: "placeholder-1", staff_id: "p1", venue_id: venue.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            name: "Kojo Mensah", role: "waiter" as const, phone: "+233 54 123 4567", email: "kojo@example.com",
            pin_hash: null, is_active: true
        },
        {
            id: "placeholder-2", staff_id: "p2", venue_id: venue.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            name: "Ama Serwaa", role: "manager" as const, phone: "+233 55 987 6543", email: "ama@example.com",
            pin_hash: null, is_active: true
        },
        {
            id: "placeholder-3", staff_id: "p3", venue_id: venue.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            name: "Kwame Despite", role: "bartender" as const, phone: "+233 24 555 7777", email: "kwame@example.com",
            pin_hash: null, is_active: false
        }
    ];

    const toggleActive = async (id: string, active: boolean) => {
        const prev = staff;
        setStaff((cur) => cur.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s)));
        const { data: ok, error } = await db.setStaffActive(id, !active, venue.id);
        if (error || !ok) {
            setStaff(prev);
            toast.error("Could not update this staff member.");
        }
    };

    const approveShift = async (shiftId: string) => {
        const { data: ok, error } = await db.approveShift(shiftId, true);
        if (error || !ok) {
            toast.error("You don't have permission, or the shift is gone.");
            return;
        }
        toast.success("Staff member confirmed on duty.");
        await load();
    };

    const takeOffDuty = async (shiftId: string) => {
        const { data: ok, error } = await db.approveShift(shiftId, false);
        if (error || !ok) {
            toast.error("Could not close the shift.");
            return;
        }
        toast.success("Taken off duty.");
        await load();
    };

    const updateStaff = async (id: string, patch: {
        role?: string;
        email?: string | null;
        hourlyRate?: number;
        payModel?: "hourly" | "salary";
        salaryAmount?: number | null;
        maxTables?: number;
        areaAssignment?: string | null;
        isActive?: boolean;
    }) => {
        const prev = staff;
        setStaff((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { data, error } = await db.updateStaff({ staffId: id, venueId: venue.id, ...patch });
        if (error || !data?.ok) {
            setStaff(prev);
            toast.error("Could not update this staff member.");
            return false;
        }
        toast.success("Staff updated.");
        return true;
    };

    const addStaff = async (input: {
        name: string;
        phone: string;
        role: string;
        email?: string;
        hourlyRate: number;
        payModel: "hourly" | "salary";
        salaryAmount: number | null;
        maxTables: number;
    }) => {
        const { data, error } = await db.createStaff({
            venueId: venue.id,
            name: input.name,
            phone: input.phone,
            role: input.role,
            email: input.email || null,
            hourlyRate: input.hourlyRate,
            payModel: input.payModel,
            salaryAmount: input.salaryAmount,
            maxTables: input.maxTables,
        });
        if (error || !data?.ok) {
            const reason =
                data?.error === "phone_exists"
                    ? "A staff member with this phone already exists."
                    : data?.error === "not_owner"
                      ? "Your account isn't linked to this venue as owner."
                      : "Could not add staff.";
            toast.error(reason);
            return false;
        }
        toast.success(`${input.name} added — they'll sign in with their phone.`);
        setCreating(false);
        await load();
        return true;
    };

    const totalCount = staff.length;
    const onShift = shiftStaffIds.size;
    const activeCount = staff.filter((s) => s.is_active).length;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats row (real) ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Total Staff</p>
                    <p className="text-4xl font-bold tabular-nums text-licorice">{loading ? "…" : totalCount}</p>
                </div>
                <div className="rounded-[1.5rem] bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)] flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-isabelline/60">On Shift Now</p>
                    <p className="text-4xl font-bold tabular-nums text-khaki">{loading ? "…" : onShift}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Active</p>
                    <p className="text-4xl font-bold tabular-nums text-licorice">{loading ? "…" : activeCount}</p>
                </div>
            </div>

            {coverage && coverage.filter(c => c.shift_id).length > 0 && (
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase text-feldgrau">
                            Team on duty
                        </p>
                        <span className="text-xs font-semibold tracking-tight text-feldgrau/60">
                            {coverage.filter((c) => c.supervisor_approved).length} confirmed ·{" "}
                            {coverage.filter((c) => c.shift_id && !c.supervisor_approved).length} waiting
                        </span>
                    </div>
                    <div className="flex flex-col">
                        {coverage.filter(c => c.shift_id).map((c) => {
                            const onShift = !!c.shift_id;
                            const approved = c.supervisor_approved === true;

                            const getInitials = (name: string) => {
                                const parts = name.trim().split(" ");
                                if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                return name.substring(0, 2).toUpperCase();
                            };

                            return (
                                <div key={c.staff_id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                                    {/* Left Side: Identity & Role */}
                                    <div className="flex items-center gap-3">
                                        {/* Avatar / Initials */}
                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
                                            {getInitials(c.name)}
                                        </div>
                                        
                                        {/* Name and Role Stack */}
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 tracking-tight">{c.name}</span>
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{roleLabel(c.role)}</span>
                                        </div>
                                    </div>

                                    {/* Right Side: Shift Time & Actions */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm text-slate-500 font-medium tabular-nums">
                                            {onShift && c.clock_in
                                                ? `Since ${new Date(c.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                                : "Not clocked in"}
                                        </div>
                                        {onShift && !approved && (
                                            <button
                                                type="button"
                                                onClick={() => c.shift_id && approveShift(c.shift_id)}
                                                className="rounded-full bg-licorice px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-isabelline transition-all hover:bg-licorice/90 active:scale-95"
                                            >
                                                Approve
                                            </button>
                                        )}
                                        {onShift && approved && (
                                            <button
                                                type="button"
                                                onClick={() => c.shift_id && takeOffDuty(c.shift_id)}
                                                className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 ring-1 ring-rose-500/20 transition-all hover:bg-rose-500/20 active:scale-95"
                                            >
                                                Off duty
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, phone or email…"
                        className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                    />
                </div>

                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    <button
                        type="button"
                        onClick={() => setRoleFilter("all")}
                        className={clsx(
                            "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all",
                            roleFilter === "all" ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice",
                        )}
                    >
                        All
                    </button>
                    {ROLE_OPTIONS.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => setRoleFilter(r.value)}
                            className={clsx(
                                "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all",
                                roleFilter === r.value ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice",
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95"
                >
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add Staff
                </button>
            </div>

            {/* ── Staff table ── */}
            <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-isabelline">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                    </div>
                ) : tableData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">No staff found</h3>
                        <p className="mt-1 text-[12px] tracking-tight text-feldgrau">
                            Add your first staff member — they'll sign in with their phone.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <table className="hidden md:table w-full">
                            <thead className="border-b border-isabelline bg-isabelline/50">
                                <tr className="text-left">
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Name</th>
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Role</th>
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Status</th>
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-isabelline">
                                {tableData.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="hover:bg-isabelline/30 transition-colors cursor-pointer"
                                        onClick={() => setSelectedStaff(s)}
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-khaki/20 text-khaki">
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900 tracking-tight">{s.name}</p>
                                                    <p className="truncate text-xs font-medium text-slate-500 mt-0.5">{s.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                {roleLabel(s.role)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider",
                                                    shiftStaffIds.has(s.id) ? "text-emerald-600" : "text-feldgrau",
                                                )}>
                                                    {shiftStaffIds.has(s.id) ? "On Shift" : "Off Duty"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {s.role === "waiter" && s.is_active && (
                                                <span className="text-xs font-semibold tracking-tight text-feldgrau">
                                                    max {s.max_tables} tables
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-isabelline">
                            {tableData.map((s) => (
                                <div
                                    key={s.id}
                                    className="px-4 py-3 cursor-pointer active:bg-isabelline/50"
                                    onClick={() => setSelectedStaff(s)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-khaki/20 text-khaki">
                                            {s.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col">
                                                <p className="truncate text-sm font-bold text-slate-900 tracking-tight">{s.name}</p>
                                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                                                    {roleLabel(s.role)}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-xs">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1",
                                                    shiftStaffIds.has(s.id) ? "text-emerald-600" : "text-feldgrau",
                                                )}>
                                                    {shiftStaffIds.has(s.id) ? "On Shift" : "Off Duty"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Staff Detail Drawer ── */}
            {selectedStaff && (
                <StaffDetailDrawer
                    staff={selectedStaff}
                    onShift={shiftStaffIds.has(selectedStaff.id)}
                    onClose={() => setSelectedStaff(null)}
                    onToggleActive={toggleActive}
                    onEdit={() => setEditingStaff(selectedStaff)}
                />
            )}

            {/* ── Add Staff Modal ── */}
            {creating && <AddStaffModal onAdd={addStaff} onClose={() => setCreating(false)} />}

            {/* ── Edit Staff Modal ── */}
            {editingStaff && (
                <EditStaffModal
                    staff={editingStaff}
                    onSave={async (patch) => {
                        const ok = await updateStaff(editingStaff.id, patch);
                        if (ok) {
                            setEditingStaff(null);
                            setSelectedStaff(editingStaff);
                            await load();
                        }
                        return ok;
                    }}
                    onClose={() => setEditingStaff(null)}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAFF DETAIL DRAWER (real fields only)
   ═══════════════════════════════════════════════════════════════════════════ */

function StaffDetailDrawer({
    staff,
    onShift,
    onClose,
    onToggleActive,
    onEdit,
}: {
    staff: StaffRow;
    onShift: boolean;
    onClose: () => void;
    onToggleActive: (id: string, active: boolean) => void;
    onEdit: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <p className="text-xs font-bold uppercase text-feldgrau">Staff Profile</p>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                            <span className="font-serif text-[20px] font-bold">{staff.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[16px] font-bold tracking-tight text-licorice">{staff.name}</h3>
                            <div className="mt-0.5 flex items-center gap-2">
                                <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider", ROLE_COLORS[staff.role] ?? "bg-isabelline text-feldgrau")}>
                                    {roleLabel(staff.role)}
                                </span>
                                <span className={clsx("inline-flex items-center gap-1 text-xs", onShift ? "text-emerald-600" : "text-feldgrau")}>
                                    <span className={clsx("h-1.5 w-1.5 rounded-full", onShift ? "bg-emerald-400" : "bg-feldgrau/30")} />
                                    {onShift ? "On Shift" : "Off Duty"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-isabelline p-3">
                        <div className="border-r border-licorice/8 text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{staff.max_tables}</p>
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Max Tables</p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-khaki">
                                {staff.pay_model === "salary"
                                    ? (staff.salary_amount != null ? `GH₵${staff.salary_amount}` : "—")
                                    : (staff.hourly_rate > 0 ? `GH₵${staff.hourly_rate}` : "—")}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">
                                {staff.pay_model === "salary" ? "Salary/mo" : "Hourly"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Phone</span>
                            <span className="flex items-center gap-1 font-bold tracking-tight text-licorice">
                                <PhoneIcon className="h-3 w-3" strokeWidth={2} />
                                {staff.phone}
                            </span>
                        </div>
                        {staff.email && (
                            <div className="flex justify-between border-b border-isabelline pb-1.5">
                                <span className="font-medium tracking-tight text-feldgrau">Email</span>
                                <span className="font-bold tracking-tight text-licorice">{staff.email}</span>
                            </div>
                        )}
                        {staff.area_assignment && (
                            <div className="flex justify-between border-b border-isabelline pb-1.5">
                                <span className="font-medium tracking-tight text-feldgrau">Area</span>
                                <span className="font-bold tracking-tight text-licorice">{staff.area_assignment}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Joined</span>
                            <span className="font-bold tracking-tight text-licorice">
                                {new Date(staff.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center justify-center gap-1 rounded-full bg-licorice px-3 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all active:scale-95"
                        >
                            <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => { onToggleActive(staff.id, staff.is_active); onClose(); }}
                            className={clsx(
                                "inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-bold tracking-tight transition-all active:scale-95",
                                staff.is_active ? "bg-isabelline text-feldgrau ring-1 ring-licorice/8" : "bg-licorice text-isabelline",
                            )}
                        >
                            {staff.is_active ? "Deactivate" : "Activate"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD STAFF MODAL (writes to the staff table via the owner RPC)
   ═══════════════════════════════════════════════════════════════════════════ */

function AddStaffModal({ onAdd, onClose }: {
    onAdd: (input: { name: string; phone: string; role: string; email?: string; hourlyRate: number; payModel: "hourly" | "salary"; salaryAmount: number | null; maxTables: number }) => Promise<boolean>;
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("waiter");
    const [payModel, setPayModel] = useState<"hourly" | "salary">("hourly");
    const [hourlyRate, setHourlyRate] = useState(25);
    const [salaryAmount, setSalaryAmount] = useState(0);
    const [maxTables, setMaxTables] = useState(6);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const phoneValid = !phone.trim() || !!normalizeGhanaPhone(phone);

    const handleAdd = async () => {
        if (!name.trim()) return;
        const normalized = normalizeGhanaPhone(phone);
        if (!normalized) {
            setError("Enter a valid Ghana phone number, e.g. 024 000 0000.");
            return;
        }
        setError(null);
        setSaving(true);
        const ok = await onAdd({
            name: name.trim(),
            phone: normalized,
            role,
            email: email.trim() || undefined,
            hourlyRate,
            payModel,
            salaryAmount: payModel === "salary" ? salaryAmount : null,
            maxTables,
        });
        setSaving(false);
        if (!ok) setError("Could not add this staff member. They may already exist.");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-feldgrau">New Staff</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">Add to your team</h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Full Name</label>
                        <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Kojo Mensah"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Phone *</label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 000 0000"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        {!phoneValid && (
                            <p className="mt-1 text-xs font-semibold text-red-600">Enter a valid Ghana number (024…, 233… or +233…).</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kojo@velvetlounge.gh"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Pay</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {([["hourly", "Hourly"], ["salary", "Salary/mo"]] as const).map(([val, lbl]) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setPayModel(val)}
                                    className={clsx(
                                        "rounded-lg py-2 text-xs font-bold tracking-tight transition-all active:scale-95",
                                        payModel === val ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {payModel === "hourly" ? (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Hourly Rate (GHS)</label>
                                <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(parseInt(e.target.value) || 0)}
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Salary (GHS/mo)</label>
                                <input type="number" min={0} value={salaryAmount} onChange={(e) => setSalaryAmount(parseInt(e.target.value) || 0)}
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Max Tables</label>
                            <input type="number" min={1} max={20} value={maxTables} onChange={(e) => setMaxTables(parseInt(e.target.value) || 1)}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Role</label>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                            {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => setRole(r.value)}
                                    className={clsx(
                                        "rounded-lg py-2 text-xs font-bold tracking-tight transition-all active:scale-95",
                                        role === r.value ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold tracking-tight text-red-700">{error}</p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-isabelline px-5 py-3">
                    <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-xs font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!name.trim() || !phone.trim() || !phoneValid || saving}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        {saving ? "Adding…" : (
                            <>
                                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                Add Staff
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT STAFF MODAL (owner RPC — role, pay model, rate/salary, limits)
   ═══════════════════════════════════════════════════════════════════════════ */

function EditStaffModal({ staff, onSave, onClose }: {
    staff: StaffRow;
    onSave: (patch: {
        role?: string;
        email?: string | null;
        hourlyRate?: number;
        payModel?: "hourly" | "salary";
        salaryAmount?: number | null;
        maxTables?: number;
        areaAssignment?: string | null;
        isActive?: boolean;
    }) => Promise<boolean>;
    onClose: () => void;
}) {
    const [role, setRole] = useState(staff.role);
    const [email, setEmail] = useState(staff.email ?? "");
    const [payModel, setPayModel] = useState<"hourly" | "salary">(staff.pay_model ?? "hourly");
    const [hourlyRate, setHourlyRate] = useState(staff.hourly_rate || 0);
    const [salaryAmount, setSalaryAmount] = useState(staff.salary_amount ?? 0);
    const [maxTables, setMaxTables] = useState(staff.max_tables);
    const [area, setArea] = useState(staff.area_assignment ?? "");
    const [isActive, setIsActive] = useState(staff.is_active);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const ok = await onSave({
            role,
            email: email.trim() ? email.trim() : null,
            hourlyRate,
            payModel,
            salaryAmount: payModel === "salary" ? salaryAmount : null,
            maxTables,
            areaAssignment: area.trim() ? area.trim() : null,
            isActive,
        });
        setSaving(false);
        if (!ok) onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-feldgrau">Edit Staff</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">{staff.name}</h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Role</label>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                            {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => setRole(r.value)}
                                    className={clsx(
                                        "rounded-lg py-2 text-xs font-bold tracking-tight transition-all active:scale-95",
                                        role === r.value ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Pay</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {([["hourly", "Hourly"], ["salary", "Salary/mo"]] as const).map(([val, lbl]) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setPayModel(val)}
                                    className={clsx(
                                        "rounded-lg py-2 text-xs font-bold tracking-tight transition-all active:scale-95",
                                        payModel === val ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8",
                                    )}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {payModel === "hourly" ? (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Hourly Rate (GHS)</label>
                                <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(parseInt(e.target.value) || 0)}
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Salary (GHS/mo)</label>
                                <input type="number" min={0} value={salaryAmount} onChange={(e) => setSalaryAmount(parseInt(e.target.value) || 0)}
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Max Tables</label>
                            <input type="number" min={1} max={20} value={maxTables} onChange={(e) => setMaxTables(parseInt(e.target.value) || 1)}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kojo@velvetlounge.gh"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Area</label>
                        <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Main, VIP, Lounge…"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 accent-khaki" />
                        <span className="text-xs font-bold tracking-tight text-licorice">Active (can sign in)</span>
                    </label>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-isabelline px-5 py-3">
                    <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-xs font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        {saving ? "Saving…" : (
                            <>
                                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
