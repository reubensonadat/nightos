import { useState, type FormEvent, type ReactNode } from "react";
import {
    ArrowRightIcon,
    BanknotesIcon,
    ChartBarIcon,
    ClipboardDocumentCheckIcon,
    EyeIcon,
    LockClosedIcon,
    MapIcon,
    MegaphoneIcon,
    Squares2X2Icon,
    UserCircleIcon,
    UserIcon,
    UsersIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";

/* ────────────────────────── Admin Login Screen ────────────────────────── */

type LoginProps = {
    onSignIn: (managerName: string) => void;
};

export function AdminLoginScreen({ onSignIn }: LoginProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email.trim() || !password.trim()) {
            setError("Please enter your email and password.");
            return;
        }
        setLoading(true);
        window.setTimeout(() => {
            setLoading(false);
            const name = email.split("@")[0].replace(/[^a-zA-Z]/g, "").replace(/^\w/, (c) => c.toUpperCase());
            onSignIn(name || "Manager");
        }, 1200);
    };

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col">
            {/* Top brand bar */}
            <div className="px-6 pt-[max(env(safe-area-inset-top),24px)] pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                        <span className="font-serif text-[16px] font-bold leading-none tracking-tight">V</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[14px] font-bold tracking-tight text-licorice">Velvet Lounge</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">Manager Portal · Bysen</span>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 items-center justify-center px-6 py-8">
                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">Admin Sign In</p>
                        <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                            Control room
                            <br />
                            <span className="italic font-serif font-bold text-khaki">for the floor</span>
                        </h1>
                        <p className="mt-2 max-w-[320px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                            Live ops, menus, staff, finance, and CRM — all in one dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <div>
                            <label htmlFor="admin-email" className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Email</label>
                            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                <UserIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                <input
                                    id="admin-email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="manager@velvetlounge.gh"
                                    className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="admin-password" className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Password</label>
                            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20 transition-all">
                                <LockClosedIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                <input
                                    id="admin-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="text-feldgrau transition-colors hover:text-licorice"
                                >
                                    <EyeIcon className="h-4 w-4" strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="rounded-lg bg-dark-red/8 px-3 py-2 text-[11px] font-semibold tracking-tight text-dark-red">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] ring-1 ring-licorice/80 transition-all duration-200 hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-80"
                        >
                            {loading ? (
                                <>
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-tight text-feldgrau">
                    <ShieldCheckIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Secured by Bysen · Supabase Auth</span>
                </div>
            </div>
        </main>
    );
}

/* ────────────────────────── Manager Shell ────────────────────────── */

export type ManagerPage =
    | "ops"
    | "floorplan"
    | "menu"
    | "staff"
    | "finance"
    | "crm";

type NavItem = {
    id: ManagerPage;
    label: string;
    icon: typeof Squares2X2Icon;
};

const NAV_ITEMS: NavItem[] = [
    { id: "ops", label: "Live Ops", icon: Squares2X2Icon },
    { id: "floorplan", label: "Floorplan", icon: MapIcon },
    { id: "menu", label: "Menu & Inventory", icon: ClipboardDocumentCheckIcon },
    { id: "staff", label: "Staff & Roles", icon: UsersIcon },
    { id: "finance", label: "Financial Reports", icon: BanknotesIcon },
    { id: "crm", label: "CRM & Marketing", icon: MegaphoneIcon },
];

type ShellProps = {
    managerName: string;
    activePage: ManagerPage;
    onPageChange: (page: ManagerPage) => void;
    onSignOut: () => void;
    children: ReactNode;
};

export function ManagerShell({ managerName, activePage, onPageChange, onSignOut, children }: ShellProps) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const activeItem = NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0];

    return (
        <div className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                DESKTOP SIDEBAR (md and up)
              ═══════════════════════════════════════════════════════════ */}
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-licorice/8 bg-white">
                {/* Brand */}
                <div className="flex items-center gap-2.5 border-b border-licorice/8 px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                        <span className="font-serif text-[15px] font-bold leading-none tracking-tight">V</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">Velvet Lounge</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">Manager Portal</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    <p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Operations</p>
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.id === activePage;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onPageChange(item.id)}
                                className={`
                                    mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5
                                    text-[12.5px] font-bold tracking-tight transition-all duration-150
                                    ${isActive
                                        ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                        : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                                    }
                                `}
                            >
                                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                                <span className="truncate">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* User card */}
                <div className="border-t border-licorice/8 p-3">
                    <div className="flex items-center gap-2.5 rounded-lg bg-isabelline px-3 py-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-khaki/20 text-khaki">
                            <UserCircleIcon className="h-5 w-5" strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-bold tracking-tight text-licorice">{managerName}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-feldgrau">Manager</p>
                        </div>
                        <button
                            type="button"
                            onClick={onSignOut}
                            aria-label="Sign out"
                            className="text-[9px] font-bold uppercase tracking-wider text-feldgrau transition-colors hover:text-dark-red"
                        >
                            Exit
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══════════════════════════════════════════════════════════
                MOBILE TOP BAR + DRAWER
              ═══════════════════════════════════════════════════════════ */}
            <header className="md:hidden sticky top-0 z-30 border-b border-licorice/8 bg-white/95 backdrop-blur-xl">
                <div className="flex items-center justify-between px-5 py-3">
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        aria-label="Open navigation"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice"
                    >
                        <Squares2X2Icon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">{activeItem.label}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">Manager Portal</span>
                    </div>
                    <button
                        type="button"
                        onClick={onSignOut}
                        aria-label="Sign out"
                        className="text-[10px] font-bold uppercase tracking-wider text-feldgrau"
                    >
                        Exit
                    </button>
                </div>
            </header>

            {/* Mobile drawer */}
            {mobileNavOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="absolute inset-0 bg-licorice/40 backdrop-blur-sm"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <aside className="relative flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-licorice/8 px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-licorice text-isabelline">
                                    <span className="font-serif text-[13px] font-bold leading-none">V</span>
                                </div>
                                <span className="text-[12px] font-bold tracking-tight">Manager Portal</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(false)}
                                aria-label="Close navigation"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                            >
                                <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto px-3 py-4">
                            {NAV_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.id === activePage;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            onPageChange(item.id);
                                            setMobileNavOpen(false);
                                        }}
                                        className={`
                                            mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5
                                            text-[12.5px] font-bold tracking-tight transition-all duration-150
                                            ${isActive
                                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                                            }
                                        `}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                                        <span className="truncate">{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                MAIN CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <div className="md:pl-64">
                {/* Desktop top bar */}
                <header className="hidden md:flex sticky top-0 z-20 items-center justify-between border-b border-licorice/8 bg-isabelline/95 backdrop-blur-xl px-8 py-3">
                    <div className="flex items-center gap-2">
                        <ChartBarIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                        <h1 className="text-[15px] font-bold tracking-tight text-licorice">{activeItem.label}</h1>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-khaki/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-khaki">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-khaki" />
                            Live
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] font-bold tabular-nums text-feldgrau">
                            {new Date().toLocaleDateString("en-GH", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="font-mono text-[12px] font-bold tabular-nums text-licorice">
                            {new Date().toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                    </div>
                </header>

                {/* Page content */}
                <main className="px-5 py-6 md:px-8 md:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
