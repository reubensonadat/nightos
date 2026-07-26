import { useState } from "react";
import {
    CheckIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ShieldCheckIcon,
    StarIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { STAFF, type StaffMember } from "../../data/managerData";
import clsx from "clsx";

/* ────────────────────────── Constants ────────────────────────── */

const ROLE_COLORS: Record<StaffMember["role"], string> = {
    Manager: "bg-licorice text-isabelline",
    Waiter: "bg-khaki/20 text-khaki",
    Kitchen: "bg-light-blue/20 text-licorice",
    Bartender: "bg-feldgrau/20 text-feldgrau",
};

const SHIFT_LABELS: Record<string, { dot: string; text: string; label: string }> = {
    on: { dot: "bg-emerald-400", text: "text-emerald-600", label: "On Shift" },
    break: { dot: "bg-amber-400", text: "text-amber-600", label: "On Break" },
    off: { dot: "bg-feldgrau/30", text: "text-feldgrau", label: "Off Duty" },
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
    Manager: ["All access", "Reports", "Staff mgmt", "Menu edit", "CRM", "Analytics"],
    Waiter: ["Take orders", "Manage tables", "Process payments", "View shift", "View menu"],
    Kitchen: ["View KDS", "Update order status", "Mark items complete"],
    Bartender: ["View bar queue", "Update drink status", "View menu"],
};

/* ────────────────────────── Component ────────────────────────── */

export function StaffManagerScreen() {
    const [staff, setStaff] = useState<StaffMember[]>(STAFF);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<StaffMember["role"] | "All">("All");
    const [creating, setCreating] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    const filtered = staff.filter((s) => {
        if (roleFilter !== "All" && s.role !== roleFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
        }
        return true;
    });

    const toggleActive = (id: string) => {
        setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    };

    const addStaff = (newStaff: StaffMember) => {
        setStaff((prev) => [newStaff, ...prev]);
        setCreating(false);
    };

    /* ── Stats ── */
    const totalCount = staff.length;
    const onShift = staff.filter((s) => s.currentShift === "on").length;
    const totalHoursThisWeek = staff.reduce((s, m) => s + m.hoursThisWeek, 0);
    const totalPayroll = staff.reduce((s, m) => s + m.hoursThisWeek * m.hourlyRate, 0);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats row (enhanced) ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Staff</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalCount}</p>
                </div>
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">On Shift Now</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{onShift}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Hours This Week</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalHoursThisWeek}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Payroll (week)</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{formatGHS(totalPayroll)}</p>
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
                        placeholder="Search staff by name or email…"
                        className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                    />
                </div>

                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    {(["All", "Manager", "Waiter", "Kitchen", "Bartender"] as const).map((r) => {
                        const isActive = r === roleFilter;
                        return (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRoleFilter(r)}
                                className={clsx(
                                    "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all",
                                    isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"
                                )}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95"
                >
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add Staff
                </button>
            </div>

            {/* ── Staff table ── */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                {/* Desktop table */}
                <table className="hidden md:table w-full">
                    <thead className="border-b border-isabelline bg-isabelline/50">
                        <tr className="text-left">
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Name</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Role</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Performance</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">This Week</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Status</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline">
                        {filtered.map((s) => {
                            const shift = SHIFT_LABELS[s.currentShift || "off"];
                            return (
                                <tr
                                    key={s.id}
                                    className="hover:bg-isabelline/30 transition-colors cursor-pointer"
                                    onClick={() => setSelectedStaff(s)}
                                >
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                                                <span className="font-serif text-[13px] font-bold leading-none">{s.name.charAt(0)}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{s.name}</p>
                                                <p className="truncate text-[10px] tracking-tight text-feldgrau">{s.email} · {s.phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", ROLE_COLORS[s.role])}>
                                            {s.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-3 text-[11px]">
                                            {(s.role === "Waiter" || s.role === "Bartender") && (
                                                <>
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Sales</p>
                                                        <p className="font-mono font-bold tabular-nums text-licorice">{formatGHS(s.totalSales)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Rating</p>
                                                        <p className="font-mono font-bold tabular-nums text-khaki">
                                                            <StarIcon className="h-3 w-3 inline" strokeWidth={2} /> {s.rating}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                            {s.role === "Manager" && (
                                                <span className="text-[10px] italic tracking-tight text-feldgrau">Management</span>
                                            )}
                                            {(s.role === "Kitchen") && (
                                                <span className="text-[10px] italic tracking-tight text-feldgrau">Kitchen support</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="text-[11px]">
                                            <p className="font-bold tabular-nums text-licorice">{s.shiftsThisWeek} shifts</p>
                                            <p className="text-[10px] text-feldgrau">{s.hoursThisWeek}h ({formatGHS(s.hoursThisWeek * s.hourlyRate)})</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleActive(s.id); }}
                                                aria-label={s.active ? "Deactivate" : "Activate"}
                                                className={clsx(
                                                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                                    s.active ? "bg-khaki" : "bg-feldgrau/20"
                                                )}
                                            >
                                                <span className={clsx(
                                                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                                                    s.active ? "translate-x-5" : "translate-x-1"
                                                )} />
                                            </button>
                                            <span className={clsx(
                                                "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                                                shift.text
                                            )}>
                                                <span className={clsx("h-1.5 w-1.5 rounded-full", shift.dot)} />
                                                {shift.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        {s.role === "Waiter" && s.active && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-600">
                                                <StarIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                                {s.tablesServed} tables
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-isabelline">
                    {filtered.map((s) => {
                        const shift = SHIFT_LABELS[s.currentShift || "off"];
                        return (
                            <div
                                key={s.id}
                                className="px-4 py-3 cursor-pointer active:bg-isabelline/50"
                                onClick={() => setSelectedStaff(s)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                                        <span className="font-serif text-[14px] font-bold leading-none">{s.name.charAt(0)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{s.name}</p>
                                            <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider", ROLE_COLORS[s.role])}>
                                                {s.role}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                            <span className={clsx("inline-flex items-center gap-1", shift.text)}>
                                                <span className={clsx("h-1.5 w-1.5 rounded-full", shift.dot)} />
                                                {shift.label}
                                            </span>
                                            <span className="text-feldgrau">·</span>
                                            <span className="text-feldgrau">{s.hoursThisWeek}h this week</span>
                                        </div>
                                    </div>
                                </div>
                                {(s.role === "Waiter" || s.role === "Bartender") && (
                                    <div className="mt-2 flex items-center gap-3 pl-13 text-[10px]">
                                        <span className="text-feldgrau">Sales: <span className="font-bold tabular-nums text-licorice">{formatGHS(s.totalSales)}</span></span>
                                        <span className="text-khaki"><StarIcon className="h-2.5 w-2.5 inline" strokeWidth={2} /> {s.rating}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Role permissions reference ── */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Role Permissions</p>
                </div>
                <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Access matrix</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    {(Object.keys(ROLE_PERMISSIONS) as StaffMember["role"][]).map((role) => (
                        <div key={role} className="rounded-xl bg-isabelline p-3">
                            <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", ROLE_COLORS[role])}>
                                {role}
                            </span>
                            <ul className="mt-2 space-y-1">
                                {ROLE_PERMISSIONS[role].map((perm) => (
                                    <li key={perm} className="flex items-center gap-1.5 text-[10.5px] tracking-tight text-licorice">
                                        <CheckIcon className="h-3 w-3 shrink-0 text-khaki" strokeWidth={2.5} />
                                        {perm}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Staff Detail Drawer ── */}
            {selectedStaff && (
                <StaffDetailDrawer staff={selectedStaff} onClose={() => setSelectedStaff(null)} onToggleActive={toggleActive} />
            )}

            {/* ── Add Staff Modal ── */}
            {creating && (
                <AddStaffModal onAdd={addStaff} onClose={() => setCreating(false)} />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAFF DETAIL DRAWER
   ═══════════════════════════════════════════════════════════════════════════ */

function StaffDetailDrawer({
    staff,
    onClose,
    onToggleActive,
}: {
    staff: StaffMember;
    onClose: () => void;
    onToggleActive: (id: string) => void;
}) {
    const shift = SHIFT_LABELS[staff.currentShift || "off"];
    const weeklyEarnings = staff.hoursThisWeek * staff.hourlyRate;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Staff Profile</p>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                            <span className="font-serif text-[20px] font-bold">{staff.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[16px] font-bold tracking-tight text-licorice">{staff.name}</h3>
                            <div className="mt-0.5 flex items-center gap-2">
                                <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", ROLE_COLORS[staff.role])}>
                                    {staff.role}
                                </span>
                                <span className={clsx("inline-flex items-center gap-1 text-[10px]", shift.text)}>
                                    <span className={clsx("h-1.5 w-1.5 rounded-full", shift.dot)} />
                                    {shift.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats grid */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-isabelline p-3">
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{staff.shiftsThisWeek}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Shifts</p>
                        </div>
                        <div className="border-x border-licorice/8 text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-licorice">{staff.hoursThisWeek}h</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Hours</p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[16px] font-black tabular-nums text-khaki">{formatGHS(weeklyEarnings)}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Earnings</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="mt-4 space-y-2 text-[11px]">
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Email</span>
                            <span className="font-bold tracking-tight text-licorice">{staff.email}</span>
                        </div>
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Phone</span>
                            <span className="font-bold tracking-tight text-licorice">{staff.phone}</span>
                        </div>
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Hourly Rate</span>
                            <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(staff.hourlyRate)}/hr</span>
                        </div>
                        <div className="flex justify-between border-b border-isabelline pb-1.5">
                            <span className="font-medium tracking-tight text-feldgrau">Joined</span>
                            <span className="font-bold tracking-tight text-licorice">{staff.joinedAt}</span>
                        </div>
                        {staff.totalSales > 0 && (
                            <div className="flex justify-between border-b border-isabelline pb-1.5">
                                <span className="font-medium tracking-tight text-feldgrau">Total Sales</span>
                                <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(staff.totalSales)}</span>
                            </div>
                        )}
                        {staff.tablesServed > 0 && (
                            <div className="flex justify-between">
                                <span className="font-medium tracking-tight text-feldgrau">Tables Served</span>
                                <span className="font-mono font-bold tabular-nums text-licorice">{staff.tablesServed}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => { onToggleActive(staff.id); onClose(); }}
                            className={clsx(
                                "inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold tracking-tight transition-all active:scale-95",
                                staff.active ? "bg-isabelline text-feldgrau ring-1 ring-licorice/8" : "bg-licorice text-isabelline"
                            )}
                        >
                            {staff.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1 rounded-full bg-licorice px-3 py-2 text-[10px] font-bold tracking-tight text-isabelline shadow-sm active:scale-95"
                        >
                            <ClockIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            View Schedule
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD STAFF MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function AddStaffModal({ onAdd, onClose }: { onAdd: (staff: StaffMember) => void; onClose: () => void }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState<StaffMember["role"]>("Waiter");
    const [hourlyRate, setHourlyRate] = useState(25);

    const handleAdd = () => {
        if (!name.trim() || !email.trim()) return;
        onAdd({
            id: `s-${Date.now()}`,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || "+233 24 000 0000",
            role,
            active: true,
            joinedAt: new Date().toISOString().split("T")[0],
            hourlyRate,
            tablesServed: 0,
            totalSales: 0,
            rating: 5.0,
            shiftsThisWeek: 0,
            hoursThisWeek: 0,
            currentShift: "off",
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">New Staff</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">Create staff account</h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Full Name</label>
                        <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Kojo Mensah"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kojo@velvetlounge.gh"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Phone</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 24 000 0000"
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Hourly Rate (GHS)</label>
                            <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(parseInt(e.target.value) || 0)}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Role</label>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                            {(["Manager", "Waiter", "Kitchen", "Bartender"] as const).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={clsx(
                                        "rounded-lg py-2 text-[10px] font-bold tracking-tight transition-all active:scale-95",
                                        role === r ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8"
                                    )}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-isabelline px-5 py-3">
                    <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!name.trim() || !email.trim()}
                        className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                    >
                        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}