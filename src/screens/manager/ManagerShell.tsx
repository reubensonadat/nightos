import { useState, useRef, useEffect, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
    ArrowRightIcon,
    BanknotesIcon,
    Bars3Icon,
    BuildingStorefrontIcon,
    CheckIcon,
    ChevronUpDownIcon,
    ClipboardDocumentCheckIcon,
    ClipboardDocumentListIcon,
    DocumentChartBarIcon,
    EyeIcon,
    LinkIcon,
    LockClosedIcon,
    MapIcon,
    Squares2X2Icon,
    UserCircleIcon,
    UserIcon,
    UsersIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import signoutBlackIcon from "../../assets/sign-out-black.svg";
import { ManagerSignOutModal } from "../../components/ManagerSignOutModal";


/* ────────────────────────── Admin Login Screen ────────────────────────── */

type LoginProps = {
    venueName?: string;
    venueLogo?: string | null;
    onSignIn: (managerName: string) => void;
};

export function AdminLoginScreen({ venueName, venueLogo, onSignIn }: LoginProps) {
    const { venue: authVenue } = useAuth();
    const displayName = venueName || authVenue?.name || "Velvet Lounge";
    const displayInitial = (displayName.trim().charAt(0) || "V").toUpperCase();
    const displayLogo = venueLogo || authVenue?.logo_url;

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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)] overflow-hidden">
                        {displayLogo ? (
                            <img src={displayLogo} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                            <span className="font-serif text-[16px] font-bold leading-none tracking-tight">{displayInitial}</span>
                        )}
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[14px] font-bold tracking-tight text-licorice">{displayName}</span>
                        <span className="text-xs font-semibold uppercase text-feldgrau">Manager Portal · Bysen</span>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 items-center justify-center px-6 py-8">
                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <p className="text-xs font-bold uppercase text-khaki">Admin Sign In</p>
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
                            <label htmlFor="admin-email" className="text-xs font-bold uppercase text-feldgrau">Email</label>
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
                            <label htmlFor="admin-password" className="text-xs font-bold uppercase text-feldgrau">Password</label>
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
                            <p className="rounded-lg bg-dark-red/8 px-3 py-2 text-xs font-semibold tracking-tight text-dark-red">{error}</p>
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
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-tight text-feldgrau">
                    <ShieldCheckIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Secured by Bysen · Supabase Auth</span>
                </div>
            </div>
        </main>
    );
}

/* ────────────────────────── Navigation Configuration ────────────────────────── */

export type ManagerPage = "ops" | "shift-report" | "floorplan" | "orders" | "menu" | "staff" | "finance" | "crm" | "brand";

type NavItem = {
    id: ManagerPage;
    label: string;
    icon: typeof Squares2X2Icon;
};

const NAV_ITEMS: NavItem[] = [
    { id: "ops", label: "Dashboard", icon: Squares2X2Icon },
    { id: "shift-report", label: "Shift Report", icon: DocumentChartBarIcon },
    { id: "floorplan", label: "Tables", icon: MapIcon },
    { id: "orders", label: "All Orders", icon: ClipboardDocumentListIcon },
    { id: "menu", label: "Menu & Inventory", icon: ClipboardDocumentCheckIcon },
    { id: "staff", label: "Staff & Roles", icon: UsersIcon },
    { id: "finance", label: "Financial Reports", icon: BanknotesIcon },
    { id: "crm", label: "CRM & Marketing", icon: UserCircleIcon },
    { id: "brand", label: "Brand & Tax Settings", icon: BuildingStorefrontIcon },
];

/* ────────────────────────── Manager Shell Component ────────────────────────── */

type ShellProps = {
    managerName: string;
    venueName?: string;
    venueLogo?: string | null;
    activePage: ManagerPage;
    onPageChange: (page: ManagerPage) => void;
    onSignOut: () => void;
    children: ReactNode;
};

export function ManagerShell({ managerName, venueName, venueLogo, activePage, onPageChange, onSignOut, children }: ShellProps) {
    const navigate = useNavigate();
    const { venue: authVenue, venues, switchVenue, staffSession } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
    const venueDropdownRef = useRef<HTMLDivElement | null>(null);

    const displayVenueName = venueName || authVenue?.name || staffSession?.venue_name || "Velvet Lounge";
    const displayVenueLogo = venueLogo || authVenue?.logo_url || null;
    const displayVenueInitial = (displayVenueName.trim().charAt(0) || "V").toUpperCase();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (venueDropdownRef.current && !venueDropdownRef.current.contains(e.target as Node)) {
                setVenueDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeItem = NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0];
    const venueSlug = authVenue?.slug || "velvet-lounge";

    const handleCopyVenueLink = () => {
        const link = `${window.location.origin}/v/${venueSlug}/login`;
        navigator.clipboard.writeText(link);
        toast.success(`Copied venue login link: ${link}`);
    };

    return (
        <div className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                DESKTOP SIDEBAR (md and up)
              ═══════════════════════════════════════════════════════════ */}
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-licorice/8 bg-white">
                {/* Brand Header with Multi-Venue Switcher */}
                <div className="relative border-b border-licorice/8 px-4 py-3" ref={venueDropdownRef}>
                    <div
                        onClick={() => {
                            if (venues && venues.length > 1) {
                                setVenueDropdownOpen((v) => !v);
                            }
                        }}
                        className={`flex h-11 items-center gap-2.5 rounded-xl px-2 transition-all ${
                            venues && venues.length > 1
                                ? "cursor-pointer hover:bg-isabelline/70"
                                : ""
                        }`}
                        title={venues && venues.length > 1 ? "Click to switch venue" : displayVenueName}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)] overflow-hidden">
                            {displayVenueLogo ? (
                                <img src={displayVenueLogo} alt={displayVenueName} className="h-full w-full object-cover" />
                            ) : (
                                <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                                    {displayVenueInitial}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col leading-tight min-w-0 flex-1">
                            <span className="text-[13.5px] font-bold tracking-tight text-licorice truncate">
                                {displayVenueName}
                            </span>
                            <span className="text-[10px] font-semibold uppercase text-feldgrau tracking-wider">
                                {venues && venues.length > 1 ? "Switch Venue ▾" : "Manager Portal"}
                            </span>
                        </div>
                        {venues && venues.length > 1 && (
                            <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-feldgrau/70" strokeWidth={2} />
                        )}
                    </div>

                    {/* Venue Switcher Dropdown */}
                    {venueDropdownOpen && venues && venues.length > 1 && (
                        <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-50 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-licorice/10 animate-velvet-scale-in">
                            <div className="flex items-center justify-between px-2.5 py-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                                    Your Venues ({venues.length})
                                </span>
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-0.5">
                                {venues.map((v) => {
                                    const isCurrent = v.id === authVenue?.id;
                                    const init = (v.name.trim().charAt(0) || "V").toUpperCase();
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => {
                                                switchVenue(v.id);
                                                setVenueDropdownOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                                                isCurrent
                                                    ? "bg-licorice text-isabelline font-bold"
                                                    : "hover:bg-isabelline text-licorice font-medium"
                                            }`}
                                        >
                                            <div
                                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden ${
                                                    isCurrent ? "bg-white text-licorice" : "bg-licorice/10 text-licorice"
                                                }`}
                                            >
                                                {v.logo_url ? (
                                                    <img src={v.logo_url} alt={v.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    init
                                                )}
                                            </div>
                                            <span className="flex-1 truncate text-[12.5px]">{v.name}</span>
                                            {isCurrent && <CheckIcon className="h-4 w-4 shrink-0 text-isabelline" strokeWidth={2.5} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    <p className="px-2 pb-2 text-xs font-bold uppercase text-feldgrau">Operations</p>
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
                            <p className="truncate text-[13px] font-bold tracking-tight text-licorice">{managerName}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSignOutModal(true)}
                            aria-label="Sign out"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-feldgrau transition-colors hover:bg-white hover:text-dark-red"
                        >
                            <img src={signoutBlackIcon} alt="Sign Out" className="h-4 w-4" />
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
                        <Bars3Icon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[14px] font-bold tracking-tight text-licorice">{displayVenueName}</span>
                        <span className="text-[10px] font-mono text-licorice/60 font-medium">{activeItem.label}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowSignOutModal(true)}
                        aria-label="Sign out"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 active:bg-red-100 transition-colors"
                    >
                        <img src={signoutBlackIcon} alt="Sign Out" className="h-4 w-4" />
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
                        <div className="flex h-[60px] items-center justify-between border-b border-licorice/8 px-5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-licorice text-isabelline overflow-hidden">
                                    {displayVenueLogo ? (
                                        <img src={displayVenueLogo} alt={displayVenueName} className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="font-serif text-[13px] font-bold leading-none tracking-tight">
                                            {displayVenueInitial}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col leading-tight min-w-0">
                                    <span className="text-[14px] font-bold tracking-tight text-licorice truncate">{displayVenueName}</span>
                                    <span className="text-[10px] font-semibold uppercase text-feldgrau tracking-wider">Manager</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(false)}
                                aria-label="Close navigation"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice shrink-0"
                            >
                                <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>

                        {/* Mobile multi-venue switcher */}
                        {venues && venues.length > 1 && (
                            <div className="border-b border-licorice/8 px-4 py-3 bg-isabelline/40">
                                <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                                    Switch Venue
                                </p>
                                <div className="space-y-1">
                                    {venues.map((v) => {
                                        const isCurrent = v.id === authVenue?.id;
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => {
                                                    switchVenue(v.id);
                                                    setMobileNavOpen(false);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                                                    isCurrent
                                                        ? "bg-licorice text-isabelline"
                                                        : "bg-white text-licorice hover:bg-isabelline"
                                                }`}
                                            >
                                                <span className="truncate">{v.name}</span>
                                                {isCurrent && <CheckIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

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
                <header className="hidden md:flex h-[60px] sticky top-0 z-30 items-center justify-between border-b border-licorice/8 bg-isabelline/95 backdrop-blur-xl px-8">
                    <div className="flex items-center gap-3">
                        <h1 className="text-[15px] font-bold tracking-tight text-licorice">{activeItem.label}</h1>
                        <span className="text-licorice/30">•</span>
                        <div className="flex items-center gap-1.5 rounded-full bg-licorice/5 px-2.5 py-1 ring-1 ring-licorice/10">
                            <span className="text-[11px] font-bold text-licorice">{displayVenueName}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyVenueLink}
                        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-licorice shadow-sm ring-1 ring-licorice/10 hover:bg-licorice/5 transition-all active:scale-95"
                    >
                        <LinkIcon className="h-3.5 w-3.5 text-khaki" strokeWidth={2} />
                        <span>Copy Venue Link</span>
                    </button>
                </header>

                {/* Page content */}
                <main className="px-5 py-6 md:px-8 md:py-8">
                    {children}
                </main>
            </div>

            <ManagerSignOutModal
                isOpen={showSignOutModal}
                onClose={() => setShowSignOutModal(false)}
                onSignOut={onSignOut}
                onSwitchToKitchen={() => navigate("/kitchen")}
                onSwitchToWaiter={() => navigate("/waiter")}
            />
        </div>
    );
}
