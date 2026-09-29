import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowPathIcon,
    ArrowRightOnRectangleIcon,
    BanknotesIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    MinusIcon,
    PlusIcon,
    SparklesIcon,
    UserIcon,
    XMarkIcon,
    ArchiveBoxIcon,
    DocumentChartBarIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbProduct, type DbMenuCategory } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRealtime } from "../../hooks/useRealtime";
import { ShiftReportScreen } from "../manager/ShiftReportScreen";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type BarRestockEvent = {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    timestamp: string;
    staffName: string;
    notes?: string;
};

export type BarStationShift = {
    id: string;
    venueId: string;
    dateKey: string; // YYYY-MM-DD
    startedAt: string;
    startedByStaffId: string;
    startedByStaffName: string;
    startingFloat: number;
    openingStock: Record<string, number>; // productId -> quantity
    restocks: BarRestockEvent[];
    drawnStock: Record<string, number>; // productId -> quantity drawn by table orders
    status: "active" | "ended";
    endedAt?: string;
    endedByStaffName?: string;
    closingStock?: Record<string, { expected: number; counted: number; variance: number }>;
};

type TicketItem = {
    productId?: string;
    name: string;
    quantity: number;
    notes?: string | null;
};

type BarTicket = {
    id: string;
    submissionId: string;
    billId: string;
    tableNumber: number;
    tableLabel: string;
    waiterId: string | null;
    waiterName: string;
    guestName: string;
    status: "pending" | "preparing" | "ready" | "served" | "cancelled";
    placedAt: string;
    notes: string | null;
    items: TicketItem[];
};

type Props = {
    venueId: string;
    staffId: string;
    staffName: string;
    onExit?: () => void;
    onSignOut?: () => void;
};

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT FALLBACK BEVERAGE INVENTORY (If venue has no products yet)
   ═══════════════════════════════════════════════════════════════════════════ */

const FALLBACK_DRINKS: { id: string; name: string; category: string; price: number; image: string }[] = [
    { id: "henn-vsop", name: "Hennessy V.S.O.P (750ml)", category: "Cognac & Spirits", price: 1800, image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=150&q=80" },
    { id: "don-julio-1942", name: "Don Julio 1942 Tequila (750ml)", category: "Tequila", price: 6500, image: "https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=150&q=80" },
    { id: "clase-azul-rep", name: "Clase Azul Reposado (750ml)", category: "Tequila", price: 5800, image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=150&q=80" },
    { id: "moet-nectar-imp", name: "Moët & Chandon Nectar Impérial", category: "Champagne", price: 1950, image: "https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=150&q=80" },
    { id: "dom-perignon", name: "Dom Pérignon Vintage (750ml)", category: "Champagne", price: 5200, image: "https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=150&q=80" },
    { id: "ace-of-spades", name: "Armand de Brignac (Ace of Spades)", category: "Champagne", price: 8500, image: "https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=150&q=80" },
    { id: "jw-blue-label", name: "Johnnie Walker Blue Label (750ml)", category: "Whiskey", price: 3200, image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=150&q=80" },
    { id: "heineken-btl", name: "Heineken Beer (330ml)", category: "Beer & Cider", price: 35, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=150&q=80" },
    { id: "guinness-fss", name: "Guinness Foreign Extra Stout", category: "Beer & Cider", price: 35, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=150&q=80" },
    { id: "redbull-can", name: "Red Bull Energy Drink (250ml)", category: "Mixers & Softs", price: 40, image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=150&q=80" },
    { id: "tonic-water", name: "Fever-Tree Indian Tonic Water", category: "Mixers & Softs", price: 30, image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=150&q=80" },
    { id: "coca-cola", name: "Coca-Cola (Glass Bottle)", category: "Mixers & Softs", price: 25, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=150&q=80" },
    { id: "sparkling-water", name: "San Pellegrino Sparkling Water (750ml)", category: "Mixers & Softs", price: 50, image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=150&q=80" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function BarStationScreen({ venueId, staffId, staffName, onExit, onSignOut }: Props) {
    const { venue } = useAuth();
    const [activeTab, setActiveTab] = useState<"QUEUE" | "STOCK" | "REPORT">("QUEUE");

    // Products & Categories loaded from venue
    const [products, setProducts] = useState<DbProduct[]>([]);
    const [categories, setCategories] = useState<DbMenuCategory[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // Active Station Shift (Shared for this terminal across all bartenders)
    const shiftStorageKey = useMemo(() => `nightos:bar_station_shift:${venueId}`, [venueId]);
    const [activeShift, setActiveShift] = useState<BarStationShift | null>(null);

    // Load active shift from storage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(shiftStorageKey);
            if (raw) {
                const parsed: BarStationShift = JSON.parse(raw);
                if (parsed.status === "active") {
                    setActiveShift(parsed);
                }
            }
        } catch (err) {
            console.error("Failed to load bar station shift:", err);
        }
    }, [shiftStorageKey]);

    // Save shift helper
    const persistShift = useCallback((shift: BarStationShift | null) => {
        setActiveShift(shift);
        try {
            if (shift) {
                localStorage.setItem(shiftStorageKey, JSON.stringify(shift));
            } else {
                localStorage.removeItem(shiftStorageKey);
            }
        } catch (err) {
            console.error("Failed to save bar station shift:", err);
        }
    }, [shiftStorageKey]);

    // Fetch Products & Menu
    const loadProducts = useCallback(async () => {
        if (!venueId) return;
        setLoadingProducts(true);
        try {
            const [pRes, cRes] = await Promise.all([
                db.products(venueId),
                db.menuCategories(venueId),
            ]);
            setProducts(pRes.data || []);
            setCategories(cRes.data || []);
        } catch (err) {
            console.error("Failed to load venue products:", err);
        } finally {
            setLoadingProducts(false);
        }
    }, [venueId]);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    // Unified Bar Items List (using real venue products if available, fallback to nightclub drinks)
    const barProducts = useMemo(() => {
        if (products.length > 0) {
            const catMap = new Map(categories.map(c => [c.id, c.name]));
            // Filter to bar station or drinks
            const filtered = products.filter(p => {
                const catName = (catMap.get(p.category_id || "") || "").toLowerCase();
                const isDrinkCat = /drink|beverage|cocktail|spirit|wine|beer|bottle|liquor|champagne|shot|mixer|soft/i.test(catName);
                return p.station === "bar" || p.station === "both" || isDrinkCat;
            });
            const list = filtered.length > 0 ? filtered : products;
            return list.map(p => ({
                id: p.id,
                name: p.name,
                category: catMap.get(p.category_id || "") || "Beverages",
                price: p.price,
                image: p.images?.[0] || "",
            }));
        }
        return FALLBACK_DRINKS;
    }, [products, categories]);

    // Categories list for filtering
    const categoryOptions = useMemo(() => {
        const set = new Set<string>();
        barProducts.forEach(p => set.add(p.category));
        return ["All", ...Array.from(set)];
    }, [barProducts]);

    // ──────────────────────────────────────────────────────────────────────────
    // OPENING CHECKLIST FORM STATE (Scene 1)
    // ──────────────────────────────────────────────────────────────────────────
    const [openingSearch, setOpeningSearch] = useState("");
    const [openingCategory, setOpeningCategory] = useState("All");
    const [startingFloatInput, setStartingFloatInput] = useState<number>(200);
    const [stockCounts, setStockCounts] = useState<Record<string, number>>({});

    // Pre-populate stock counts when opening screen loads
    useEffect(() => {
        if (!activeShift && barProducts.length > 0) {
            setStockCounts((prev) => {
                const next = { ...prev };
                barProducts.forEach(p => {
                    if (next[p.id] === undefined) {
                        next[p.id] = 12; // Reasonable default starting case count
                    }
                });
                return next;
            });
        }
    }, [activeShift, barProducts]);

    const [savedStockCounts, setSavedStockCounts] = useState<Record<string, number>>({});

    const handleUpdateStockCount = (productId: string, val: number) => {
        const nextVal = Math.max(0, val);
        if (nextVal > 0) {
            setSavedStockCounts(prev => ({ ...prev, [productId]: nextVal }));
        }
        setStockCounts(prev => ({
            ...prev,
            [productId]: nextVal,
        }));
    };

    const handleToggleZero = (productId: string) => {
        const current = stockCounts[productId] ?? 0;
        if (current === 0) {
            // Restore previous count or default to 12
            const restored = savedStockCounts[productId] || 12;
            handleUpdateStockCount(productId, restored);
        } else {
            // Save current count and zero out
            setSavedStockCounts(prev => ({ ...prev, [productId]: current }));
            setStockCounts(prev => ({ ...prev, [productId]: 0 }));
        }
    };

    const handleStartShift = () => {
        const todayKey = new Date().toISOString().split("T")[0];
        const newShift: BarStationShift = {
            id: `bar_shift_${Date.now()}`,
            venueId,
            dateKey: todayKey,
            startedAt: new Date().toISOString(),
            startedByStaffId: staffId,
            startedByStaffName: staffName || "Bartender",
            startingFloat: startingFloatInput,
            openingStock: { ...stockCounts },
            restocks: [],
            drawnStock: {},
            status: "active",
        };
        persistShift(newShift);
        toast.success("Shift started! Bar station is open for service.", { icon: "🍸" });
    };

    // ──────────────────────────────────────────────────────────────────────────
    // REAL-TIME ORDERS QUEUE (Scene 2 - Tab 1)
    // ──────────────────────────────────────────────────────────────────────────
    const [rawTickets, setRawTickets] = useState<BarTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [recentlyPoured, setRecentlyPoured] = useState<BarTicket[]>([]);
    const [batchMode, setBatchMode] = useState(false);

    const loadTickets = useCallback(async () => {
        if (!venueId) return;
        setLoadingTickets(true);
        try {
            const { data: rows, error: dbError } = await db.kitchenOrders(venueId);
            if (dbError || !rows) return;

            // Waiter names map
            const waiterIds = Array.from(
                new Set(rows.map((r: any) => (Array.isArray(r.bills) ? r.bills[0] : r.bills)?.waiter_id).filter((id): id is string => !!id)),
            );
            const { data: staffRows } = await db.staffNamesByIds(waiterIds);
            const waiterMap: Record<string, string> = {};
            for (const s of staffRows ?? []) waiterMap[s.id] = s.name;

            const mapped: BarTicket[] = rows
                .filter((r: any) => {
                    const bill = Array.isArray(r.bills) ? r.bills[0] : r.bills;
                    return bill?.status !== "cancelled" && r.status !== "cancelled";
                })
                .map((r: any) => {
                    const bill = Array.isArray(r.bills) ? r.bills[0] : r.bills;
                    const table = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
                    const items: TicketItem[] = (r.order_items || []).map((it: any) => ({
                        productId: it.product_id,
                        name: it.product_name,
                        quantity: Number(it.quantity || 1),
                        notes: it.notes || null,
                    }));

                    return {
                        id: r.id,
                        submissionId: r.id,
                        billId: r.bill_id,
                        tableNumber: table?.table_number ?? 0,
                        tableLabel: table?.table_label || `Table ${table?.table_number || "?"}`,
                        waiterId: bill?.waiter_id || null,
                        waiterName: bill?.waiter_id ? (waiterMap[bill.waiter_id] || "Staff") : "Direct",
                        guestName: r.guest_name || "Guest",
                        status: r.status,
                        placedAt: r.created_at,
                        notes: r.notes || null,
                        items,
                    };
                });

            setRawTickets(mapped);
        } catch (err) {
            console.error("Failed to load bar orders:", err);
        } finally {
            setLoadingTickets(false);
        }
    }, [venueId]);

    useEffect(() => {
        void loadTickets();
    }, [loadTickets]);

    // Realtime listener for incoming orders
    useRealtime({
        table: "order_submissions",
        filter: venueId ? `venue_id=eq.${venueId}` : undefined,
        onInsert: loadTickets,
        onUpdate: loadTickets,
        onDelete: loadTickets,
    });

    // Active tickets awaiting pouring
    const activeTickets = useMemo(() => {
        return rawTickets
            .filter(t => t.status === "pending" || t.status === "confirmed" || t.status === "preparing")
            .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());
    }, [rawTickets]);

    // Dispense action: "POURED ✓"
    const handleDispenseTicket = async (ticket: BarTicket) => {
        try {
            await db.setOrderStatus(ticket.submissionId, "ready", staffId);

            // Record drawn items into shift
            if (activeShift) {
                const nextDrawn = { ...activeShift.drawnStock };
                ticket.items.forEach(it => {
                    const match = barProducts.find(p => p.name.toLowerCase() === it.name.toLowerCase());
                    const key = match ? match.id : it.name;
                    nextDrawn[key] = (nextDrawn[key] || 0) + it.quantity;
                });

                const updatedShift = {
                    ...activeShift,
                    drawnStock: nextDrawn,
                };
                persistShift(updatedShift);
            }

            setRecentlyPoured(prev => [ticket, ...prev.slice(0, 7)]);
            toast.success(`Poured for ${ticket.tableLabel}! Waiter notified.`, { icon: "🍹" });
            void loadTickets();
        } catch (err) {
            console.error("Failed to dispense ticket:", err);
            toast.error("Could not update ticket. Please try again.");
        }
    };

    // Batch Pouring summary across all open tickets
    const batchSummary = useMemo(() => {
        const counts = new Map<string, number>();
        activeTickets.forEach(t => {
            t.items.forEach(i => {
                counts.set(i.name, (counts.get(i.name) || 0) + i.quantity);
            });
        });
        return Array.from(counts.entries()).map(([name, qty]) => ({ name, qty }));
    }, [activeTickets]);

    // ──────────────────────────────────────────────────────────────────────────
    // MID-SHIFT RESTOCK MODAL (Scene 2 - Tab 2)
    // ──────────────────────────────────────────────────────────────────────────
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const [restockProduct, setRestockProduct] = useState(barProducts[0]?.id || "");
    const [restockQty, setRestockQty] = useState(6);
    const [restockNotes, setRestockNotes] = useState("");

    const handleSaveRestock = () => {
        if (!activeShift) return;
        const prod = barProducts.find(p => p.id === restockProduct);
        const event: BarRestockEvent = {
            id: `restock_${Date.now()}`,
            productId: restockProduct,
            productName: prod?.name || "Drink Item",
            quantity: restockQty,
            timestamp: new Date().toISOString(),
            staffName: staffName || "Bartender",
            notes: restockNotes.trim() || undefined,
        };

        const updatedShift: BarStationShift = {
            ...activeShift,
            restocks: [...activeShift.restocks, event],
        };
        persistShift(updatedShift);
        setIsRestockOpen(false);
        setRestockNotes("");
        toast.success(`Added +${restockQty} ${prod?.name || "bottles"} from storeroom!`, { icon: "📦" });
    };

    // Live remaining stock computation
    const liveStockTable = useMemo(() => {
        if (!activeShift) return [];
        return barProducts.map(p => {
            const opening = activeShift.openingStock[p.id] ?? 0;
            const added = activeShift.restocks
                .filter(r => r.productId === p.id)
                .reduce((sum, r) => sum + r.quantity, 0);
            const drawn = (activeShift.drawnStock[p.id] ?? 0) + (activeShift.drawnStock[p.name] ?? 0);
            const remaining = opening + added - drawn;

            return {
                ...p,
                opening,
                added,
                drawn,
                remaining,
            };
        });
    }, [activeShift, barProducts]);

    // ──────────────────────────────────────────────────────────────────────────
    // END OF SHIFT RECONCILIATION MODAL (Scene 3)
    // ──────────────────────────────────────────────────────────────────────────
    const [isEndShiftOpen, setIsEndShiftOpen] = useState(false);
    const [closingCounts, setClosingCounts] = useState<Record<string, number>>({});
    const [closingCashCount, setClosingCashCount] = useState<string>("");

    // Open End Shift Modal & prepopulate expected counts
    const handleOpenEndShift = () => {
        const prep: Record<string, number> = {};
        liveStockTable.forEach(item => {
            prep[item.id] = Math.max(0, item.remaining);
        });
        setClosingCounts(prep);
        setIsEndShiftOpen(true);
    };

    const handleConfirmCloseShift = () => {
        if (!activeShift) return;

        const closingMap: Record<string, { expected: number; counted: number; variance: number }> = {};
        liveStockTable.forEach(item => {
            const expected = item.remaining;
            const counted = closingCounts[item.id] ?? expected;
            closingMap[item.id] = {
                expected,
                counted,
                variance: counted - expected,
            };
        });

        const finalShift: BarStationShift = {
            ...activeShift,
            status: "ended",
            endedAt: new Date().toISOString(),
            endedByStaffName: staffName || "Bartender",
            closingStock: closingMap,
        };

        // Save archive log and clear active shift
        try {
            const historyRaw = localStorage.getItem(`nightos:bar_shifts_history:${venueId}`) || "[]";
            const history = JSON.parse(historyRaw);
            history.unshift(finalShift);
            localStorage.setItem(`nightos:bar_shifts_history:${venueId}`, JSON.stringify(history.slice(0, 30)));
        } catch { /* noop */ }

        persistShift(null);
        setIsEndShiftOpen(false);
        toast.success("Shift reconciled & closed cleanly. Handover complete!", { icon: "✅" });
    };

    /* ═══════════════════════════════════════════════════════════════════════════
       RENDER SCENE 1: SHIFT OPENING GATE (If no shift started today)
       ═══════════════════════════════════════════════════════════════════════════ */
    if (!activeShift) {
        const filteredOpeningItems = barProducts.filter(p => {
            const matchesCat = openingCategory === "All" || p.category === openingCategory;
            const matchesQ = p.name.toLowerCase().includes(openingSearch.toLowerCase());
            return matchesCat && matchesQ;
        });

        const countedItemsCount = Object.values(stockCounts).filter(v => v > 0).length;
        const outOfStockCount = Object.values(stockCounts).filter(v => v === 0).length;

        return (
            <div className="min-h-screen bg-[#F4F3E8] text-[#1A110B] p-4 sm:p-8 flex flex-col justify-between">
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1A110B]/10 pb-4">
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider text-[#606F69]">
                                Station Check-In Required
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-black text-[#1A110B] tracking-tight mt-0.5">
                                Evening Bar Stock Count & Float
                            </h1>
                            <p className="text-xs text-[#606F69] mt-0.5">
                                Log physical drinks on shelf before service so waiters cannot order depleted items.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {onSignOut && (
                                <button
                                    onClick={onSignOut}
                                    className="rounded-md bg-[#1A110B]/5 px-3 py-1.5 text-xs font-bold text-[#1A110B] hover:bg-[#1A110B]/10 transition cursor-pointer"
                                >
                                    Sign Out
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Starting Cash Float Card */}
                    <div className="rounded-lg bg-white p-4 sm:p-5 border border-[#1A110B]/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider text-[#1A110B]">
                                Starting Till Cash Float (GH₵)
                            </span>
                            <p className="text-[11px] text-[#606F69]">
                                Physical cash left in the drawer at the start of shift.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {[100, 200, 500].map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setStartingFloatInput(amt)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                                        startingFloatInput === amt
                                            ? "bg-[#1A110B] text-white shadow-xs"
                                            : "bg-[#F4F3E8] text-[#1A110B] hover:bg-[#1A110B]/10"
                                    }`}
                                >
                                    GH₵ {amt}
                                </button>
                            ))}
                            <div className="relative w-28">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#606F69]">GH₵</span>
                                <input
                                    type="number"
                                    value={startingFloatInput}
                                    onChange={e => setStartingFloatInput(Number(e.target.value))}
                                    className="w-full rounded-full border border-[#1A110B]/20 bg-white py-1.5 pl-10 pr-3 text-xs font-black text-[#1A110B] focus:outline-none focus:ring-2 focus:ring-[#1A110B]/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="space-y-3">
                        <div className="flex items-center rounded-lg bg-white px-3.5 py-2.5 border border-[#1A110B]/10 shadow-xs">
                            <MagnifyingGlassIcon className="h-4 w-4 text-[#606F69] mr-2 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search bottles & drinks (e.g. Hennessy, Tequila, Heineken)..."
                                value={openingSearch}
                                onChange={e => setOpeningSearch(e.target.value)}
                                className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#1A110B] placeholder-[#606F69] focus:outline-none"
                            />
                            {openingSearch && (
                                <button onClick={() => setOpeningSearch("")} className="text-[#606F69] hover:text-[#1A110B]">
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Category Chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            {categoryOptions.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setOpeningCategory(cat)}
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                                        openingCategory === cat
                                            ? "bg-[#1A110B] text-white shadow-xs"
                                            : "bg-white text-[#1A110B] border border-[#1A110B]/10 hover:bg-[#1A110B]/5"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Items List (List form with small thumbnail on left, as requested) */}
                    <div className="rounded-lg bg-white border border-[#1A110B]/10 shadow-xs overflow-hidden">
                        <div className="p-3 bg-[#1A110B]/5 border-b border-[#1A110B]/10 flex items-center justify-between text-[11px] font-black uppercase text-[#606F69]">
                            <span>Product & Category</span>
                            <span>Evening Opening Count</span>
                        </div>

                        {loadingProducts ? (
                            <div className="p-8 text-center text-xs font-semibold text-[#606F69] flex items-center justify-center gap-2">
                                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                Loading venue beverage inventory...
                            </div>
                        ) : (
                            <div className="divide-y divide-[#1A110B]/10 max-h-[50vh] overflow-y-auto">
                                {filteredOpeningItems.map(item => {
                                    const currentQty = stockCounts[item.id] ?? 0;
                                    const isOOS = currentQty === 0;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition ${
                                                isOOS ? "bg-rose-50/40 opacity-70" : "hover:bg-[#F4F3E8]/40"
                                            }`}
                                        >
                                            {/* Left: Thumbnail & Name */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-11 w-11 rounded-2xl bg-[#1A110B]/5 border border-[#1A110B]/10 overflow-hidden shrink-0 flex items-center justify-center">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <SparklesIcon className="h-5 w-5 text-[#606F69]" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-xs sm:text-sm text-[#1A110B] truncate">
                                                        {item.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-semibold text-[#606F69]">
                                                            {item.category}
                                                        </span>
                                                        <span className="text-[10px] text-[#1A110B]/60 font-mono">
                                                            {formatGHS(item.price)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Quantity Stepper Adjuster */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStockCount(item.id, currentQty - 1)}
                                                    className="h-8 w-10 sm:w-10 rounded-full border border-[#1A110B]/15 bg-[#F4F3E8] hover:bg-[#1A110B]/10 flex items-center justify-center font-bold text-sm cursor-pointer transition active:scale-95"
                                                >
                                                    <MinusIcon className="h-3.5 w-3.5" />
                                                </button>

                                                <input
                                                    type="number"
                                                    value={currentQty}
                                                    onChange={e => handleUpdateStockCount(item.id, Number(e.target.value))}
                                                    className="w-16 h-8 rounded-full border border-[#1A110B]/20 py-1 text-center font-black text-xs sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1A110B]/20 bg-white"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStockCount(item.id, currentQty + 1)}
                                                    className="h-8 w-10 sm:w-10 rounded-full border border-[#1A110B]/15 bg-[#F4F3E8] hover:bg-[#1A110B]/10 flex items-center justify-center font-bold text-sm cursor-pointer transition active:scale-95"
                                                >
                                                    <PlusIcon className="h-3.5 w-3.5" />
                                                </button>

                                                {/* Quick +5 button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStockCount(item.id, currentQty + 5)}
                                                    className="hidden sm:inline-flex h-8 items-center rounded-full bg-[#1A110B]/5 px-3 text-[10px] font-bold text-[#1A110B] hover:bg-[#1A110B]/10 cursor-pointer transition"
                                                >
                                                    +5
                                                </button>

                                                {/* Zero Toggle Switch */}
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={isOOS}
                                                    onClick={() => handleToggleZero(item.id)}
                                                    className="inline-flex items-center gap-1.5 cursor-pointer select-none group pl-1"
                                                    title={isOOS ? "Item is marked Zero. Click to restore count." : "Click to toggle Zero."}
                                                >
                                                    <div
                                                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                                            isOOS ? "bg-rose-600" : "bg-[#1A110B]/20 group-hover:bg-[#1A110B]/30"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                                                isOOS ? "translate-x-5" : "translate-x-0"
                                                            }`}
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-bold transition ${isOOS ? "text-rose-700 font-black" : "text-[#606F69] group-hover:text-[#1A110B]"}`}>
                                                        Zero
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Bottom Action Bar */}
                <div className="max-w-4xl mx-auto w-full pt-4 border-t border-[#1A110B]/10 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs font-semibold text-[#606F69]">
                        <span>{countedItemsCount} items ready in stock</span>
                        <span>·</span>
                        <span className={outOfStockCount > 0 ? "text-rose-800 font-bold" : ""}>
                            {outOfStockCount} marked out of stock
                        </span>
                        <span>·</span>
                        <span className="font-bold text-[#1A110B]">Till Float: {formatGHS(startingFloatInput)}</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleStartShift}
                        className="rounded-full bg-[#1A110B] px-8 py-3 text-sm font-black text-white hover:bg-[#1A110B]/90 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                        <span>Start Shift & Open Bar</span>
                    </button>
                </div>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       RENDER SCENE 2: ACTIVE BAR STATION SHELL
       ═══════════════════════════════════════════════════════════════════════════ */
    const shiftElapsedMins = Math.floor((Date.now() - new Date(activeShift.startedAt).getTime()) / 60000);
    const shiftHours = Math.floor(shiftElapsedMins / 60);
    const shiftMins = shiftElapsedMins % 60;

    return (
        <div className="min-h-screen bg-[#F4F3E8] text-[#1A110B] font-sans antialiased flex flex-col">
            {/* ═══════════════════════════════════════════════════════════
               TOP STATION NAVIGATION HEADER
               ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-[#1A110B] text-white shadow-md border-b border-white/10 px-4 sm:px-6 py-3">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Station Brand & Status */}
                    <div className="flex items-center justify-between md:justify-start gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm">
                                🍸
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="font-black text-sm tracking-tight">Main Bar Station</h1>
                                    <span className="rounded-md bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                                        Shift Active
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-white/60">
                                    <span>{staffName || "Bartender"}</span>
                                    <span>·</span>
                                    <span>Active {shiftHours > 0 ? `${shiftHours}h ` : ""}{shiftMins}m</span>
                                    <span>·</span>
                                    <span>Float: {formatGHS(activeShift.startingFloat)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Top End Shift & Sign Out Buttons (Mobile view) */}
                        <div className="flex md:hidden items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleOpenEndShift}
                                className="rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-300 px-2.5 py-1 text-xs font-bold"
                            >
                                End Shift
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab("QUEUE")}
                            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === "QUEUE"
                                    ? "bg-white text-[#1A110B] shadow-xs"
                                    : "text-white/70 hover:bg-white/10"
                            }`}
                        >
                            <ClipboardDocumentListIcon className="h-4 w-4" />
                            <span>Drink Orders Queue</span>
                            {activeTickets.length > 0 && (
                                <span className="rounded-md bg-white text-[#1A110B] px-1.5 py-0.2 text-[10px] font-black">
                                    {activeTickets.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("STOCK")}
                            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === "STOCK"
                                    ? "bg-white text-[#1A110B] shadow-xs"
                                    : "text-white/70 hover:bg-white/10"
                            }`}
                        >
                            <ArchiveBoxIcon className="h-4 w-4" />
                            <span>Evening Stock & Restock</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("REPORT")}
                            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === "REPORT"
                                    ? "bg-white text-[#1A110B] shadow-xs"
                                    : "text-white/70 hover:bg-white/10"
                            }`}
                        >
                            <DocumentChartBarIcon className="h-4 w-4" />
                            <span>Shift Report & Waiter Audit</span>
                        </button>
                    </div>

                    {/* Desktop Station Actions */}
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsRestockOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                        >
                            <PlusIcon className="h-3.5 w-3.5 text-white" />
                            <span>+ Restock Bottles</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleOpenEndShift}
                            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600/30 hover:bg-rose-600/40 border border-rose-500/40 px-3.5 py-1.5 text-xs font-bold text-rose-200 transition cursor-pointer"
                        >
                            <span>End Shift</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
               TAB 1: DRINK DISPENSE QUEUE (High-Speed Single Ticket Stream)
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "QUEUE" && (
                <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-5">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#1A110B]/10 shadow-xs">
                        <div className="flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-[#1A110B] shrink-0" />
                            <div>
                                <h2 className="text-sm font-black text-[#1A110B]">
                                    Live Table Drink Tickets ({activeTickets.length} Pending)
                                </h2>
                                <p className="text-[11px] text-[#606F69]">
                                    Tap "POURED ✓" as soon as bottles/glasses are placed on the bar counter.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setBatchMode(!batchMode)}
                                className={`rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                                    batchMode
                                        ? "bg-[#1A110B] text-white border-[#1A110B]"
                                        : "bg-[#F4F3E8] text-[#1A110B] border-[#1A110B]/15 hover:bg-[#1A110B]/10"
                                }`}
                            >
                                {batchMode ? "Hide Batch View" : "⚡ Batch Pouring Overview"}
                            </button>

                            <button
                                type="button"
                                onClick={() => void loadTickets()}
                                className="rounded-md border border-[#1A110B]/15 p-2 text-[#1A110B] hover:bg-[#1A110B]/5 transition"
                                title="Refresh Tickets"
                            >
                                <ArrowPathIcon className={`h-4 w-4 ${loadingTickets ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>

                    {/* Peak-Hour Batch Pouring Mode Banner */}
                    {batchMode && batchSummary.length > 0 && (
                        <div className="rounded-lg bg-[#1A110B] text-white p-4 shadow-md animate-in fade-in">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                                    <SparklesIcon className="h-4 w-4" />
                                    Aggregated Drinks to Pour Right Now
                                </span>
                                <span className="text-[10px] text-white/60">Across all open table tickets</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {batchSummary.map((b, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white border border-white/15"
                                    >
                                        <span className="text-emerald-400 font-mono">×{b.qty}</span>
                                        <span>{b.name}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Orders Queue List */}
                    {activeTickets.length === 0 ? (
                        <div className="rounded-lg bg-white p-12 border border-[#1A110B]/10 text-center space-y-2">
                            <div className="h-10 w-10 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-lg font-bold">
                                ✓
                            </div>
                            <h3 className="font-black text-base text-[#1A110B]">All Table Drinks Dispensed!</h3>
                            <p className="text-xs text-[#606F69] max-w-sm mx-auto">
                                The bar queue is clear. New drink tickets submitted by table waiters will stream in automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTickets.map(ticket => {
                                const waitMins = Math.floor((Date.now() - new Date(ticket.placedAt).getTime()) / 60000);
                                const isUrgent = waitMins >= 8;

                                return (
                                    <div
                                        key={ticket.id}
                                        className={`rounded-lg bg-white p-4 sm:p-5 border transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                            isUrgent
                                                ? "border-rose-300 bg-rose-50/20"
                                                : "border-[#1A110B]/10 hover:border-[#1A110B]/20"
                                        }`}
                                    >
                                        {/* Ticket Details */}
                                        <div className="space-y-2.5 min-w-0 flex-1">
                                            {/* Top info */}
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="rounded-md bg-[#1A110B] text-white px-2.5 py-1 text-xs font-black tracking-tight">
                                                    {ticket.tableLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1A110B]">
                                                    <UserIcon className="h-3.5 w-3.5 text-[#606F69]" />
                                                    <span>{ticket.waiterName}</span>
                                                </span>
                                                <span
                                                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                                        isUrgent
                                                            ? "bg-rose-100 text-rose-900 border border-rose-300"
                                                            : "bg-[#1A110B]/5 text-[#606F69]"
                                                    }`}
                                                >
                                                    {waitMins === 0 ? "Just now" : `${waitMins}m ago`}
                                                </span>
                                                <span className="text-[10px] font-mono text-[#606F69]">
                                                    #{ticket.id.slice(0, 8)}
                                                </span>
                                            </div>

                                            {/* Itemized drink lines */}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {ticket.items.map((it, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="inline-flex items-center gap-1.5 rounded-md bg-[#F4F3E8] px-3 py-1.5 text-xs font-bold text-[#1A110B] border border-[#1A110B]/10"
                                                    >
                                                        <span className="text-[#1A110B] font-mono font-black">×{it.quantity}</span>
                                                        <span>{it.name}</span>
                                                        {it.notes && (
                                                            <span className="text-[10px] font-normal italic text-slate-500">
                                                                ({it.notes})
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {ticket.notes && (
                                                <div className="text-[11px] italic text-[#1A110B] bg-[#F4F3E8] rounded-md p-2 border border-[#1A110B]/10">
                                                    Order Note: "{ticket.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Dispense Action */}
                                        <button
                                            type="button"
                                            onClick={() => void handleDispenseTicket(ticket)}
                                            className="w-full sm:w-auto rounded-lg bg-[#1A110B] hover:bg-[#1A110B]/90 text-white px-6 py-3 text-xs font-black tracking-wide shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                                            <span>POURED ✓</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Recently Poured Tray */}
                    {recentlyPoured.length > 0 && (
                        <div className="rounded-lg bg-white p-4 border border-[#1A110B]/10 shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#606F69] block mb-2">
                                Recently Poured & Handed to Waiters
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {recentlyPoured.map(t => (
                                    <div
                                        key={t.id}
                                        className="inline-flex items-center gap-2 rounded-md bg-[#F4F3E8] px-3 py-1.5 text-xs font-medium text-[#1A110B]"
                                    >
                                        <span className="font-bold">{t.tableLabel}</span>
                                        <span className="text-[#606F69]">({t.waiterName})</span>
                                        <span className="text-emerald-700 font-bold">✓</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════
               TAB 2: EVENING STOCK & RESTOCK MONITOR
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "STOCK" && (
                <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#1A110B]/10 shadow-xs">
                        <div>
                            <h2 className="text-base font-black text-[#1A110B]">
                                Evening Bottle Depletion & Storeroom Restocks
                            </h2>
                            <p className="text-xs text-[#606F69]">
                                Formula: Starting Stock + Storeroom Restocks − Drawn by Tables = Current Live Stock
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsRestockOpen(true)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1A110B] text-white px-4 py-2 text-xs font-bold hover:bg-[#1A110B]/90 transition shadow-xs cursor-pointer"
                        >
                            <PlusIcon className="h-4 w-4 text-white" />
                            <span>+ Restock Bottles</span>
                        </button>
                    </div>

                    {/* Stock Table */}
                    <div className="rounded-lg bg-white border border-[#1A110B]/10 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-[#1A110B]/10 bg-[#1A110B]/5 text-[#1A110B] font-semibold uppercase tracking-wider text-[11px]">
                                        <th className="px-4 py-3">Drink Item</th>
                                        <th className="px-3 py-3 text-center">Opening</th>
                                        <th className="px-3 py-3 text-center">Restocked</th>
                                        <th className="px-3 py-3 text-center">Table Drawn</th>
                                        <th className="px-4 py-3 text-right">Live Remaining</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1A110B]/10 font-medium">
                                    {liveStockTable.map(item => {
                                        const isLow = item.remaining <= 3 && item.remaining > 0;
                                        const isOut = item.remaining <= 0;

                                        return (
                                            <tr key={item.id} className="hover:bg-[#F4F3E8]/40 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-[#1A110B]">{item.name}</div>
                                                    <div className="text-[10px] text-[#606F69]">{item.category}</div>
                                                </td>
                                                <td className="px-3 py-3 text-center tabular-nums text-[#606F69]">
                                                    {item.opening}
                                                </td>
                                                <td className="px-3 py-3 text-center tabular-nums text-emerald-800 font-semibold">
                                                    {item.added > 0 ? `+${item.added}` : "0"}
                                                </td>
                                                <td className="px-3 py-3 text-center tabular-nums text-rose-800 font-semibold">
                                                    {item.drawn > 0 ? `-${item.drawn}` : "0"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-black tabular-nums ${
                                                            isOut
                                                                ? "bg-rose-100 text-rose-900 border border-rose-300"
                                                                : isLow
                                                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                                                : "bg-[#1A110B]/5 text-[#1A110B]"
                                                        }`}
                                                    >
                                                        {item.remaining} left
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRestockProduct(item.id);
                                                            setRestockQty(6);
                                                            setIsRestockOpen(true);
                                                        }}
                                                        className="rounded-md bg-[#1A110B]/5 hover:bg-[#1A110B]/10 px-2.5 py-1 text-[11px] font-bold text-[#1A110B] cursor-pointer"
                                                    >
                                                        + Restock
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Restock History Log */}
                    {activeShift.restocks.length > 0 && (
                        <div className="rounded-lg bg-white p-4 border border-[#1A110B]/10 shadow-xs space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#606F69]">
                                Shift Storeroom Restock History ({activeShift.restocks.length} transfers)
                            </span>
                            <div className="divide-y divide-[#1A110B]/10 text-xs">
                                {activeShift.restocks.map(r => (
                                    <div key={r.id} className="py-2 flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-[#1A110B]">+{r.quantity} {r.productName}</span>
                                            <span className="text-[10px] text-[#606F69] ml-2">by {r.staffName}</span>
                                        </div>
                                        <span className="text-[10px] text-[#606F69] font-mono">
                                            {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════
               TAB 3: SHIFT REPORT & WAITER AUDIT (Exact Manager Screen)
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "REPORT" && (
                <div className="flex-1 w-full">
                    <ShiftReportScreen venueId={venueId} isModal={false} />
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
               MID-SHIFT RESTOCK MODAL
               ═══════════════════════════════════════════════════════════ */}
            {isRestockOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl border border-[#1A110B]/20 text-[#1A110B] space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-3">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#606F69]">
                                    Mid-Shift Replenishment
                                </span>
                                <h3 className="text-base font-black text-[#1A110B]">
                                    Restock Bottles from Storeroom
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsRestockOpen(false)}
                                className="rounded-md bg-[#1A110B]/5 hover:bg-[#1A110B]/10 p-1.5 text-[#1A110B]"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-[#1A110B] block mb-1">Select Beverage Item</label>
                                <select
                                    value={restockProduct}
                                    onChange={e => setRestockProduct(e.target.value)}
                                    className="w-full rounded-md border border-[#1A110B]/15 bg-[#F4F3E8] p-2.5 font-bold text-xs"
                                >
                                    {barProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-[#1A110B] block mb-1">Bottles Added</label>
                                <div className="flex items-center gap-2">
                                    {[3, 6, 12, 24].map(qty => (
                                        <button
                                            key={qty}
                                            type="button"
                                            onClick={() => setRestockQty(qty)}
                                            className={`rounded-md px-3 py-1.5 font-bold cursor-pointer transition ${
                                                restockQty === qty
                                                    ? "bg-[#1A110B] text-white"
                                                    : "bg-[#F4F3E8] text-[#1A110B]"
                                            }`}
                                        >
                                            +{qty}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        value={restockQty}
                                        onChange={e => setRestockQty(Number(e.target.value))}
                                        className="w-20 rounded-md border border-[#1A110B]/20 p-1.5 text-center font-black"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-[#1A110B] block mb-1">Notes (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Brought up by supervisor from main cellar"
                                    value={restockNotes}
                                    onChange={e => setRestockNotes(e.target.value)}
                                    className="w-full rounded-md border border-[#1A110B]/15 p-2 font-medium bg-white"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-[#1A110B]/10">
                            <button
                                type="button"
                                onClick={() => setIsRestockOpen(false)}
                                className="flex-1 rounded-md bg-[#F4F3E8] py-2.5 text-xs font-bold text-[#1A110B]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRestock}
                                className="flex-1 rounded-md bg-[#1A110B] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1A110B]/90"
                            >
                                Save Restock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
               END OF SHIFT RECONCILIATION MODAL (Scene 3)
               ═══════════════════════════════════════════════════════════ */}
            {isEndShiftOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl border border-[#1A110B]/20 text-[#1A110B] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-3">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                                    Closing Stock Reconciliation & Handover
                                </span>
                                <h3 className="text-lg font-black text-[#1A110B]">
                                    Physical Count-Out & Shift Close
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsEndShiftOpen(false)}
                                className="rounded-md bg-[#1A110B]/5 hover:bg-[#1A110B]/10 p-1.5 text-[#1A110B]"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto space-y-4 pr-1">
                            <p className="text-xs text-[#606F69]">
                                Verify actual physical bottles left on shelf against system expected stock:
                            </p>

                            {/* Stock Reconciliation List */}
                            <div className="divide-y divide-[#1A110B]/10 border border-[#1A110B]/10 rounded-md max-h-56 overflow-y-auto text-xs">
                                {liveStockTable.map(item => {
                                    const expected = item.remaining;
                                    const counted = closingCounts[item.id] ?? expected;
                                    const diff = counted - expected;

                                    return (
                                        <div key={item.id} className="p-2.5 flex items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-[#1A110B] truncate">{item.name}</div>
                                                <div className="text-[10px] text-[#606F69]">
                                                    Expected: {expected} (Start {item.opening} + In {item.added} − Drawn {item.drawn})
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <input
                                                    type="number"
                                                    value={counted}
                                                    onChange={e => setClosingCounts({ ...closingCounts, [item.id]: Number(e.target.value) })}
                                                    className="w-16 rounded-md border border-[#1A110B]/20 py-1 text-center font-black tabular-nums"
                                                />

                                                {diff !== 0 ? (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs ${
                                                        diff < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                                    }`}>
                                                        {diff > 0 ? `+${diff} Over` : `${diff} Short`}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                                                        Balanced
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Cash Count */}
                            <div className="rounded-lg bg-[#F4F3E8] p-3.5 space-y-2 text-xs">
                                <span className="font-bold text-[#1A110B] block">Counted Cash in Till at Close (GH₵)</span>
                                <input
                                    type="text"
                                    placeholder="Enter physical cash counted..."
                                    value={closingCashCount}
                                    onChange={e => setClosingCashCount(e.target.value)}
                                    className="w-full rounded-md border border-[#1A110B]/15 bg-white p-2 font-bold text-sm"
                                />
                                <span className="text-[10px] text-[#606F69] block">
                                    Starting float recorded at shift open was {formatGHS(activeShift.startingFloat)}.
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-[#1A110B]/10">
                            <button
                                type="button"
                                onClick={() => setIsEndShiftOpen(false)}
                                className="flex-1 rounded-md bg-[#F4F3E8] py-2.5 text-xs font-bold text-[#1A110B]"
                            >
                                Back to Service
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCloseShift}
                                className="flex-1 rounded-md bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white shadow-xs transition"
                            >
                                Confirm & Close Station Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
