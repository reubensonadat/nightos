import { useState } from "react";
import {
    CheckIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ShieldCheckIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";

/* ────────────────────────── Types & mock data ────────────────────────── */

type Role = "Manager" | "Waiter" | "Kitchen";

type StaffMember = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: Role;
    active: boolean;
    joinedAt: string;
    tablesServed: number;
    totalSales: number;
    rating: number;
};

const MOCK_STAFF: StaffMember[] = [
    { id: "s1", name: "Kojo Mensah", email: "kojo@velvetlounge.gh", phone: "+233 24 123 4567", role: "Waiter", active: true, joinedAt: "2024-03-15", tablesServed: 142, totalSales: 18450, rating: 4.8 },
    { id: "s2", name: "Ama Boateng", email: "ama@velvetlounge.gh", phone: "+233 24 987 6543", role: "Waiter", active: true, joinedAt: "2023-11-08", tablesServed: 198, totalSales: 26200, rating: 4.9 },
    { id: "s3", name: "Kwame Asante", email: "kwame@velvetlounge.gh", phone: "+233 26 555 0199", role: "Kitchen", active: true, joinedAt: "2024-01-22", tablesServed: 0, totalSales: 0, rating: 4.7 },
    { id: "s4", name: "Akosua Owusu", email: "akosua@velvetlounge.gh", phone: "+233 24 444 2288", role: "Manager", active: true, joinedAt: "2023-06-10", tablesServed: 0, totalSales: 0, rating: 5.0 },
    { id: "s5", name: "Yaw Ankomah", email: "yaw@velvetlounge.gh", phone: "+233 27 333 1100", role: "Waiter", active: false, joinedAt: "2024-05-01", tablesServed: 38, totalSales: 4120, rating: 4.4 },
    { id: "s6", name: "Esi Dankwa", email: "esi@velvetlounge.gh", phone: "+233 24 777 9090", role: "Kitchen", active: true, joinedAt: "2024-02-14", tablesServed: 0, totalSales: 0, rating: 4.6 },
];

const ROLE_COLORS: Record<Role, string> = {
    Manager: "bg-licorice text-isabelline",
    Waiter: "bg-khaki/20 text-khaki",
    Kitchen: "bg-light-blue/20 text-licorice",
};

const ROLE_PERMISSIONS: Record<Role, string[]> = {
    Manager: ["All access", "Reports", "Staff mgmt", "Menu edit", "CRM"],
    Waiter: ["Take orders", "Manage tables", "Process payments", "View shift"],
    Kitchen: ["View KDS", "Update order status"],
};

/* ────────────────────────── Component ────────────────────────── */

export function StaffManagerScreen() {
    const [staff, setStaff] = useState<StaffMember[]>(MOCK_STAFF);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<Role | "All">("All");
    const [creating, setCreating] = useState(false);

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
    const activeCount = staff.filter((s) => s.active).length;
    const byRole = (role: Role) => staff.filter((s) => s.role === role).length;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Staff</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{staff.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Active Now</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{activeCount}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Waiters</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{byRole("Waiter")}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Kitchen</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{byRole("Kitchen")}</p>
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
                    {(["All", "Manager", "Waiter", "Kitchen"] as const).map((r) => {
                        const isActive = r === roleFilter;
                        return (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRoleFilter(r)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all ${isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"}`}
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
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Status</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline">
                        {filtered.map((s) => (
                            <tr key={s.id} className="hover:bg-isabelline/30 transition-colors">
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                                            <span className="font-serif text-[13px] font-bold leading-none">{s.name.charAt(0)}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{s.name}</p>
                                            <p className="truncate text-[10px] tracking-tight text-feldgrau">{s.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ROLE_COLORS[s.role]}`}>
                                        {s.role}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    {s.role === "Waiter" ? (
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Tables</p>
                                                <p className="font-mono font-bold tabular-nums text-licorice">{s.tablesServed}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Sales</p>
                                                <p className="font-mono font-bold tabular-nums text-licorice">{formatGHS(s.totalSales)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Rating</p>
                                                <p className="font-mono font-bold tabular-nums text-khaki">★ {s.rating}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] italic tracking-tight text-feldgrau">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(s.id)}
                                        aria-label={s.active ? "Deactivate" : "Activate"}
                                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${s.active ? "bg-khaki" : "bg-feldgrau/20"}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${s.active ? "translate-x-5" : "translate-x-1"}`} />
                                    </button>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${s.active ? "text-khaki" : "text-feldgrau"}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${s.active ? "bg-khaki" : "bg-feldgrau/40"}`} />
                                        {s.active ? "On shift" : "Off"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-isabelline">
                    {filtered.map((s) => (
                        <div key={s.id} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                                    <span className="font-serif text-[14px] font-bold leading-none">{s.name.charAt(0)}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{s.name}</p>
                                    <p className="truncate text-[10px] tracking-tight text-feldgrau">{s.email}</p>
                                </div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${ROLE_COLORS[s.role]}`}>
                                    {s.role}
                                </span>
                            </div>
                            {s.role === "Waiter" && (
                                <div className="mt-2 flex items-center gap-3 pl-13 text-[10px]">
                                    <span className="text-feldgrau">Tables: <span className="font-bold tabular-nums text-licorice">{s.tablesServed}</span></span>
                                    <span className="text-feldgrau">Sales: <span className="font-bold tabular-nums text-licorice">{formatGHS(s.totalSales)}</span></span>
                                    <span className="text-khaki">★ {s.rating}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Role permissions reference ── */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-isabelline">
                <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Role Permissions</p>
                </div>
                <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-licorice">Access matrix</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => (
                        <div key={role} className="rounded-xl bg-isabelline p-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
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

            {/* ── Add Staff Modal ── */}
            {creating && <AddStaffModal onAdd={addStaff} onClose={() => setCreating(false)} />}
        </div>
    );
}

/* ────────────────────────── Add Staff Modal ────────────────────────── */

type AddStaffProps = {
    onAdd: (staff: StaffMember) => void;
    onClose: () => void;
};

function AddStaffModal({ onAdd, onClose }: AddStaffProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState<Role>("Waiter");

    const handleAdd = () => {
        if (!name.trim() || !email.trim()) return;
        onAdd({
            id: `s-${Date.now()}`,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            role,
            active: true,
            joinedAt: new Date().toISOString().split("T")[0],
            tablesServed: 0,
            totalSales: 0,
            rating: 5.0,
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
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                    >
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Full Name</label>
                        <input
                            type="text"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Kojo Mensah"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="kojo@velvetlounge.gh"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Phone</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+233 24 000 0000"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Role</label>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            {(["Manager", "Waiter", "Kitchen"] as Role[]).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`rounded-lg py-2 text-[11px] font-bold tracking-tight transition-all active:scale-95 ${role === r ? "bg-licorice text-isabelline shadow-sm" : "bg-isabelline text-feldgrau ring-1 ring-licorice/8"}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
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
