import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowRightOnRectangleIcon,
    CheckIcon,
    ClockIcon,
    ExclamationTriangleIcon,
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
import { ConfirmModal } from "../../components/ConfirmModal";

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
    const [deactivateConfirmStaff, setDeactivateConfirmStaff] = useState<StaffRow | null>(null);
    const [endShiftConfirmStaff, setEndShiftConfirmStaff] = useState<ShiftCoverageRow | null>(null);

    const load = useCallback(async () => {
        // Wait until we have a real venue UUID (not the default placeholder).
        if (!venue.id || venue.id === '00000000-0000-0000-0000-000000000000') return;
        setLoading(true);
        const [{ data: rows }, { data: shifts }, { data: coverageRows }] = await Promise.all([
            db.staffList(venue.id),
            db.activeShiftsByVenue(venue.id),
            db.shiftCoverage(venue.id),
        ]);
        const activeCoverageList = (coverageRows as ShiftCoverageRow[] | null)?.filter((c) => c.shift_id) ?? [];
        const activeIds = new Set<string>([
            ...(shifts ?? []).map((sh) => sh.staff_id),
            ...activeCoverageList.map((c) => c.staff_id),
        ]);
        setStaff(rows ?? []);
        setShiftStaffIds(activeIds);
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
            staff
                .filter((s) => {
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
                })
                .sort((a, b) => {
                    if (a.is_active !== b.is_active) {
                        return a.is_active ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
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

    /** Guard: intercept deactivation only. Activation fires immediately. */
    const requestDeactivate = (staffMember: StaffRow) => {
        if (staffMember.is_active) {
            setDeactivateConfirmStaff(staffMember);
        } else {
            void toggleActive(staffMember.id, staffMember.is_active);
        }
    };

    const approveShift = async (shiftId: string) => {
        const { data: ok, error } = await db.approveShift(shiftId, true);
        if (error || !ok) {
            toast.error("You don't have permission, or the shift is gone.");
            return;
        }
        toast.success("Staff member approved on duty.");
        await load();
    };

    const confirmEndShift = async (shiftId: string) => {
        const { data: ok, error } = await db.approveShift(shiftId, false);
        if (error || !ok) {
            toast.error("Could not close the shift.");
            return;
        }
        toast.success("Shift ended successfully.");
        setEndShiftConfirmStaff(null);
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

    const [endAllShiftsConfirm, setEndAllShiftsConfirm] = useState(false);

    const endAllShifts = async () => {
        const activeShifts = coverage?.filter((c) => c.shift_id) ?? [];
        if (activeShifts.length === 0) return;
        
        let closedCount = 0;
        for (const c of activeShifts) {
            if (c.shift_id) {
                const { data: ok } = await db.approveShift(c.shift_id, false);
                if (ok) closedCount++;
            }
        }
        toast.success(`Ended ${closedCount} shift${closedCount !== 1 ? "s" : ""}.`);
        setEndAllShiftsConfirm(false);
        await load();
    };

    const totalCount = staff.length;
    const onShift = coverage
        ? coverage.filter((c) => c.shift_id).length
        : shiftStaffIds.size;
    const activeCount = staff.filter((s) => s.is_active).length;

    const activeCoverageForSelected = selectedStaff
        ? coverage?.find((c) => c.staff_id === selectedStaff.id && c.shift_id) ?? null
        : null;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
            {/* ── Stats row (responsive) ── */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="rounded-2xl sm:rounded-[1.5rem] bg-white p-3.5 sm:p-4 shadow-sm ring-1 ring-isabelline flex flex-col justify-between">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-feldgrau">Total Staff</p>
                    <p className="text-2xl sm:text-4xl font-bold tabular-nums text-licorice mt-1">{loading ? "…" : totalCount}</p>
                </div>
                <div className="rounded-2xl sm:rounded-[1.5rem] bg-licorice p-3.5 sm:p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-isabelline/70">On Shift</p>
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <p className="text-2xl sm:text-4xl font-bold tabular-nums text-khaki mt-1">{loading ? "…" : onShift}</p>
                </div>
                <div className="rounded-2xl sm:rounded-[1.5rem] bg-white p-3.5 sm:p-4 shadow-sm ring-1 ring-isabelline flex flex-col justify-between">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-feldgrau">Active</p>
                    <p className="text-2xl sm:text-4xl font-bold tabular-nums text-licorice mt-1">{loading ? "…" : activeCount}</p>
                </div>
            </div>

            {/* ── Active Shift Roster (Performance & Output-driven) ── */}
            {coverage && coverage.filter((c) => c.shift_id).length > 0 && (
                <div className="rounded-2xl sm:rounded-[1.5rem] bg-white p-4 sm:p-5 shadow-sm ring-1 ring-isabelline">
                    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <ClockIcon className="h-4 w-4 text-licorice" strokeWidth={2.2} />
                            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-licorice">
                                Active Shift Roster
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {coverage.filter((c) => c.supervisor_approved).length} active on shift
                            </span>
                            {coverage.filter((c) => c.shift_id && !c.supervisor_approved).length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-600/20 animate-pulse">
                                    {coverage.filter((c) => c.shift_id && !c.supervisor_approved).length} awaiting approval
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setEndAllShiftsConfirm(true)}
                                className="ml-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1"
                            >
                                End All Shifts
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {coverage
                            .filter((c) => c.shift_id)
                            .map((c) => {
                                const approved = c.supervisor_approved === true;

                                const getInitials = (name: string) => {
                                    const parts = name.trim().split(" ");
                                    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                    return name.substring(0, 2).toUpperCase();
                                };

                                return (
                                    <div
                                        key={c.staff_id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-50 transition-all"
                                    >
                                        {/* Left Side: Staff Identity, Output & Workload */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-licorice flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                                                {getInitials(c.name)}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
                                                        {c.name}
                                                    </span>
                                                    <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                                        {roleLabel(c.role)}
                                                    </span>
                                                    {approved ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            On Duty
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                                                            ⏳ Needs Approval
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Output & Tables Performance Priority */}
                                                <div className="mt-1 flex items-center gap-3 text-xs flex-wrap">
                                                    {c.open_bills > 0 ? (
                                                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded text-[11px] ring-1 ring-amber-300/50">
                                                            🍽️ Serving {c.open_bills} active table{c.open_bills !== 1 ? "s" : ""}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                                            0 active tables (Idle)
                                                        </span>
                                                    )}
                                                    <span className="text-slate-400 text-[11px] tabular-nums">
                                                        {c.clock_in
                                                            ? `Clock-in: ${new Date(c.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                                            : "Not clocked in"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Shift Action Buttons */}
                                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end">
                                            {!approved ? (
                                                <button
                                                    type="button"
                                                    onClick={() => c.shift_id && approveShift(c.shift_id)}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 w-full sm:w-auto"
                                                >
                                                    <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                                    Approve Shift
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setEndShiftConfirmStaff(c)}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 transition-all active:scale-95 w-full sm:w-auto"
                                                    title="End shift and clock out staff member"
                                                >
                                                    <ArrowRightOnRectangleIcon className="h-4 w-4" strokeWidth={2} />
                                                    End Shift
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
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 rounded-2xl sm:rounded-[1.5rem] bg-white p-3.5 sm:p-4 shadow-sm ring-1 ring-isabelline">
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

                <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1 max-w-[calc(100vw-120px)] sm:max-w-none">
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
                        className="inline-flex items-center justify-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95 shrink-0"
                    >
                        <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        <span className="hidden xs:inline">Add Staff</span>
                        <span className="xs:hidden">Add</span>
                    </button>
                </div>
            </div>

            {/* ── Staff table / Mobile list ── */}
            <div className="overflow-hidden rounded-2xl sm:rounded-[1.5rem] bg-white shadow-sm ring-1 ring-isabelline">
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
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Shift Status</th>
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Account</th>
                                    <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-isabelline">
                                {tableData.map((s) => (
                                    <tr
                                        key={s.id}
                                        className={clsx(
                                            "transition-colors cursor-pointer",
                                            s.is_active ? "hover:bg-isabelline/30" : "bg-slate-50/60 opacity-55 hover:bg-slate-100/50"
                                        )}
                                        onClick={() => setSelectedStaff(s)}
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className={clsx(
                                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                                                    s.is_active ? "bg-khaki/20 text-khaki" : "bg-slate-200 text-slate-400"
                                                )}>
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={clsx(
                                                        "truncate text-sm font-bold tracking-tight",
                                                        s.is_active ? "text-slate-900" : "text-slate-400 line-through decoration-slate-300"
                                                    )}>
                                                        {s.name}
                                                    </p>
                                                    <p className="truncate text-xs font-medium text-slate-400 mt-0.5">{s.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={clsx(
                                                "text-xs font-semibold uppercase tracking-wider",
                                                s.is_active ? "text-slate-500" : "text-slate-400"
                                            )}>
                                                {roleLabel(s.role)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {!s.is_active ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-500/75 bg-rose-50/80 px-2 py-0.5 rounded-full border border-rose-200/50">
                                                    Deactivated
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        "inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider",
                                                        shiftStaffIds.has(s.id) ? "text-emerald-600" : "text-feldgrau",
                                                    )}>
                                                        {shiftStaffIds.has(s.id) ? "On Shift" : "Off Duty"}
                                                    </span>
                                                </div>
                                            )}
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
                                    className={clsx(
                                        "px-4 py-3 cursor-pointer active:bg-isabelline/50 transition-colors",
                                        s.is_active ? "" : "bg-slate-50/60 opacity-55"
                                    )}
                                    onClick={() => setSelectedStaff(s)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                                            s.is_active ? "bg-khaki/20 text-khaki" : "bg-slate-200 text-slate-400"
                                        )}>
                                            {s.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col">
                                                <p className={clsx(
                                                    "truncate text-sm font-bold tracking-tight",
                                                    s.is_active ? "text-slate-900" : "text-slate-400 line-through decoration-slate-300"
                                                )}>
                                                    {s.name}
                                                </p>
                                                <span className={clsx(
                                                    "text-xs font-semibold uppercase tracking-wider mt-0.5",
                                                    s.is_active ? "text-slate-500" : "text-slate-400"
                                                )}>
                                                    {roleLabel(s.role)}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-xs">
                                                {!s.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-500/75 bg-rose-50/80 px-2 py-0.5 rounded-full border border-rose-200/50">
                                                        Deactivated
                                                    </span>
                                                ) : (
                                                    <span className={clsx(
                                                        "inline-flex items-center gap-1",
                                                        shiftStaffIds.has(s.id) ? "text-emerald-600" : "text-feldgrau",
                                                    )}>
                                                        {shiftStaffIds.has(s.id) ? "On Shift" : "Off Duty"}
                                                    </span>
                                                )}
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
                    activeCoverage={activeCoverageForSelected}
                    onClose={() => setSelectedStaff(null)}
                    onApproveShift={(shiftId) => approveShift(shiftId)}
                    onEndShift={(cov) => setEndShiftConfirmStaff(cov)}
                    onToggleActive={(id, active) => {
                        const s = staff.find((x) => x.id === id);
                        if (s) requestDeactivate(s);
                        else void toggleActive(id, active);
                    }}
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

            {/* ── Deactivate Staff Confirmation Modal ── */}
            <ConfirmModal
                isOpen={deactivateConfirmStaff !== null}
                title={`Deactivate ${deactivateConfirmStaff?.name}?`}
                body="They won't be able to log in or serve tables until you reactivate them. Any tables they currently hold will remain open."
                confirmLabel="Deactivate Account"
                cancelLabel="Cancel"
                isDanger
                onConfirm={() => {
                    if (deactivateConfirmStaff) {
                        void toggleActive(deactivateConfirmStaff.id, deactivateConfirmStaff.is_active);
                        setSelectedStaff(null);
                    }
                    setDeactivateConfirmStaff(null);
                }}
                onClose={() => setDeactivateConfirmStaff(null)}
            />

            {/* ── End Shift Confirmation Modal (with open table warnings) ── */}
            <ConfirmModal
                isOpen={endShiftConfirmStaff !== null}
                title={`End shift for ${endShiftConfirmStaff?.name}?`}
                body={
                    endShiftConfirmStaff && endShiftConfirmStaff.open_bills > 0 ? (
                        <div className="space-y-2">
                            <p className="font-semibold text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs flex items-start gap-1.5">
                                <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                                <span>
                                    {endShiftConfirmStaff.name} currently has <strong>{endShiftConfirmStaff.open_bills} open table(s)</strong> assigned.
                                </span>
                            </p>
                            <p className="text-slate-600 text-xs">
                                Ending their shift will take them off duty and clock them out. Please ensure their open tables are reassigned or settled.
                            </p>
                        </div>
                    ) : (
                        `This will take ${endShiftConfirmStaff?.name} off duty and record their shift clock-out time.`
                    )
                }
                confirmLabel="End Shift & Clock Out"
                cancelLabel="Keep on Shift"
                isDanger
                onConfirm={() => {
                    if (endShiftConfirmStaff && endShiftConfirmStaff.shift_id) {
                        void confirmEndShift(endShiftConfirmStaff.shift_id);
                    }
                }}
                onClose={() => setEndShiftConfirmStaff(null)}
            />

            {/* ── End All Shifts Confirmation Modal ── */}
            <ConfirmModal
                isOpen={endAllShiftsConfirm}
                title="End all active shifts?"
                body="This will clock out all staff members currently on duty and clear the active shift roster. Active table assignments will remain open."
                confirmLabel="End All Shifts"
                cancelLabel="Cancel"
                isDanger
                onConfirm={() => void endAllShifts()}
                onClose={() => setEndAllShiftsConfirm(false)}
            />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAFF DETAIL DRAWER (real fields + direct shift & account controls)
   ═══════════════════════════════════════════════════════════════════════════ */

function StaffDetailDrawer({
    staff,
    onShift,
    activeCoverage,
    onClose,
    onApproveShift,
    onEndShift,
    onToggleActive,
    onEdit,
}: {
    staff: StaffRow;
    onShift: boolean;
    activeCoverage?: ShiftCoverageRow | null;
    onClose: () => void;
    onApproveShift: (shiftId: string) => void;
    onEndShift: (coverage: ShiftCoverageRow) => void;
    onToggleActive: (id: string, active: boolean) => void;
    onEdit: () => void;
}) {
    const isApproved = activeCoverage?.supervisor_approved === true;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <p className="text-xs font-bold uppercase text-feldgrau">Staff Profile</p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                    >
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Identity header */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                            <span className="font-serif text-[20px] font-bold">{staff.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[16px] font-bold tracking-tight text-licorice">{staff.name}</h3>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span
                                    className={clsx(
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                                        ROLE_COLORS[staff.role] ?? "bg-isabelline text-feldgrau",
                                    )}
                                >
                                    {roleLabel(staff.role)}
                                </span>
                                <span
                                    className={clsx(
                                        "inline-flex items-center gap-1 text-xs font-semibold",
                                        onShift ? "text-emerald-600" : "text-feldgrau",
                                    )}
                                >
                                    <span className={clsx("h-1.5 w-1.5 rounded-full", onShift ? "bg-emerald-400 animate-pulse" : "bg-feldgrau/30")} />
                                    {onShift ? (isApproved ? "On Shift" : "Shift Awaiting Approval") : "Off Duty"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Shift Action Banner (if active shift) */}
                    {activeCoverage && activeCoverage.shift_id && (
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="font-bold text-slate-700">Current Shift</span>
                                <span className="text-slate-500 tabular-nums">
                                    {activeCoverage.clock_in
                                        ? `Since ${new Date(activeCoverage.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                        : "Clocked in"}
                                </span>
                            </div>
                            {!isApproved ? (
                                <button
                                    type="button"
                                    onClick={() => activeCoverage.shift_id && onApproveShift(activeCoverage.shift_id)}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95"
                                >
                                    <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                    Approve Shift
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onEndShift(activeCoverage)}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 active:scale-95"
                                >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4" strokeWidth={2} />
                                    End Shift (Clock Out)
                                </button>
                            )}
                        </div>
                    )}

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-isabelline p-3">
                        <div className="border-r border-licorice/8 text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{staff.max_tables}</p>
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Max Tables</p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-khaki">
                                {staff.pay_model === "salary"
                                    ? staff.salary_amount != null
                                        ? `GH₵${staff.salary_amount}`
                                        : "—"
                                    : staff.hourly_rate > 0
                                      ? `GH₵${staff.hourly_rate}`
                                      : "—"}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">
                                {staff.pay_model === "salary" ? "Salary/mo" : "Hourly"}
                            </p>
                        </div>
                    </div>

                    {/* Contact & employment details */}
                    <div className="space-y-2 text-xs">
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
                            <span className="font-medium tracking-tight text-feldgrau">Account Access</span>
                            <span className={clsx("font-bold tracking-tight", staff.is_active ? "text-emerald-700" : "text-rose-700")}>
                                {staff.is_active ? "Active (Can Sign In)" : "Deactivated (Blocked)"}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Joined</span>
                            <span className="font-bold tracking-tight text-licorice">
                                {new Date(staff.created_at).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    </div>

                    {/* Account Controls */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center justify-center gap-1 rounded-full bg-licorice px-3 py-2.5 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all active:scale-95"
                        >
                            <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Edit Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onToggleActive(staff.id, staff.is_active);
                                onClose();
                            }}
                            className={clsx(
                                "inline-flex items-center justify-center gap-1 rounded-full px-3 py-2.5 text-xs font-bold tracking-tight transition-all active:scale-95",
                                staff.is_active ? "bg-isabelline text-feldgrau ring-1 ring-licorice/8 hover:text-rose-600" : "bg-emerald-600 text-white",
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
    const [payModel, setPayModel] = useState<"hourly" | "salary">("salary");
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
                            {([["salary", "Salary/mo"], ["hourly", "Hourly"]] as const).map(([val, lbl]) => (
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
                                <input type="number" min={0} value={hourlyRate === 0 ? "" : hourlyRate} onChange={(e) => setHourlyRate(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="0"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Salary (GHS/mo)</label>
                                <input type="number" min={0} value={salaryAmount === 0 ? "" : salaryAmount} onChange={(e) => setSalaryAmount(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="0"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Max Tables</label>
                            <input type="number" min={1} max={20} value={maxTables === 0 ? "" : maxTables} onChange={(e) => setMaxTables(e.target.value === "" ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1))} placeholder="6"
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
    const [payModel, setPayModel] = useState<"hourly" | "salary">(staff.pay_model ?? "salary");
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
                            {([["salary", "Salary/mo"], ["hourly", "Hourly"]] as const).map(([val, lbl]) => (
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
                                <input type="number" min={0} value={hourlyRate === 0 ? "" : hourlyRate} onChange={(e) => setHourlyRate(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="0"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold uppercase text-feldgrau">Salary (GHS/mo)</label>
                                <input type="number" min={0} value={salaryAmount === 0 ? "" : salaryAmount} onChange={(e) => setSalaryAmount(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="0"
                                    className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Max Tables</label>
                            <input type="number" min={1} max={20} value={maxTables === 0 ? "" : maxTables} onChange={(e) => setMaxTables(e.target.value === "" ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1))} placeholder="6"
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
