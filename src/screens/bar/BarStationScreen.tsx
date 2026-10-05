import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowPathIcon,
    ArrowRightOnRectangleIcon,
    BanknotesIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ClipboardDocumentListIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    DocumentChartBarIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    MinusIcon,
    PlusIcon,
    UserIcon,
    XMarkIcon,
    ArchiveBoxIcon,
    SparklesIcon,
    CheckCircleIcon,
    InformationCircleIcon,
    CheckBadgeIcon,
    CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbProduct, type DbMenuCategory } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useRealtime } from "../../hooks/useRealtime";
import { BysenIcon } from "../../components/BysenLogo";

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
    directAdjustments?: Record<string, number>; // productId -> walk-up direct adjustments
    status: "active" | "ended";
    endedAt?: string;
    endedByStaffName?: string;
    closingStock?: Record<string, { expected: number; counted: number; variance: number }>;
    closingCashCounted?: number;
    handoverNotes?: string;
    summaryTotals?: {
        totalOrders: number;
        totalRevenue: number;
        cashRevenue: number;
        momoRevenue: number;
        cardRevenue: number;
    };
};

type TicketItem = {
    productId?: string;
    name: string;
    quantity: number;
    unitPrice?: number;
    lineTotal?: number;
    notes?: string | null;
};

type BarTicket = {
    id: string;
    submissionId: string;
    billId: string;
    billStatus?: string;
    tableNumber: number;
    tableLabel: string;
    waiterId: string | null;
    waiterName: string;
    guestName: string;
    status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "cancelled";
    placedAt: string;
    notes: string | null;
    items: TicketItem[];
    totalAmount?: number;
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
    const { signOut, venue } = useAuth();
    const [activeTab, setActiveTab] = useState<"QUEUE" | "STOCK" | "REPORT">("QUEUE");

    // Products & Categories loaded from venue
    const [products, setProducts] = useState<DbProduct[]>([]);
    const [categories, setCategories] = useState<DbMenuCategory[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // Active Station Shift (Shared for this terminal across all bartenders)
    const shiftStorageKey = useMemo(() => `nightos:bar_station_shift:${venueId}`, [venueId]);
    const [activeShift, setActiveShift] = useState<BarStationShift | null>(null);
    const [loadingShift, setLoadingShift] = useState(true);

    // Load initial shift
    useEffect(() => {
        const init = async () => {
            if (!venueId) {
                setLoadingShift(false);
                return;
            }
            try {
                const { data } = await db.activeBarShift(venueId);
                if (data && data.status === "active") {
                    setActiveShift({
                        id: data.id,
                        venueId: data.venue_id || venueId,
                        dateKey: (data.started_at || "").slice(0, 10),
                        startedAt: data.started_at,
                        startedByStaffId: data.started_by_staff_id,
                        startedByStaffName: data.started_by_staff_name || "Bartender",
                        startingFloat: Number(data.starting_float || 200),
                        openingStock: data.opening_stock || {},
                        restocks: data.restocks || [],
                        drawnStock: data.drawn_stock || {},
                        directAdjustments: data.direct_adjustments || {},
                        status: "active",
                    });
                    setLoadingShift(false);
                    return;
                }
            } catch (err) {
                console.error("Failed to load active bar shift from DB:", err);
            }

            try {
                const raw = localStorage.getItem(shiftStorageKey);
                if (raw) {
                    const parsed: BarStationShift = JSON.parse(raw);
                    if (parsed.status === "active") {
                        setActiveShift(parsed);
                    }
                }
            } catch (err) {
                console.error("Failed to load bar station shift from storage:", err);
            } finally {
                setLoadingShift(false);
            }
        };
        init();
    }, [venueId, shiftStorageKey]);

    // Save shift helper
    const persistShift = useCallback((shift: BarStationShift | null) => {
        setActiveShift(shift);
        try {
            if (shift) {
                localStorage.setItem(shiftStorageKey, JSON.stringify(shift));
                if (shift.id) {
                    void db.updateBarShift(shift.id, {
                        drawn_stock: shift.drawnStock || {},
                        direct_adjustments: shift.directAdjustments || {},
                        restocks: shift.restocks || [],
                    });
                }
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

    const handleStartShift = async () => {
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
            directAdjustments: {},
            status: "active",
        };
        persistShift(newShift);
        try {
            const { data } = await db.startBarShift(venueId, newShift);
            if (data?.id) {
                newShift.id = data.id;
                setActiveShift(newShift);
                try { localStorage.setItem(shiftStorageKey, JSON.stringify(newShift)); } catch { /* noop */ }
            }
        } catch (e) {
            console.error("Error starting bar shift in DB:", e);
        }
        toast.success("Bar station opened for service! Table ordering is live.", { icon: "🍸" });
    };

    // ──────────────────────────────────────────────────────────────────────────
    // REAL-TIME ORDERS QUEUE (Scene 2 - Tab 1)
    // ──────────────────────────────────────────────────────────────────────────
    const [rawTickets, setRawTickets] = useState<BarTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [recentlyPoured, setRecentlyPoured] = useState<BarTicket[]>([]);

    const loadTickets = useCallback(async () => {
        if (!venueId) return;
        setLoadingTickets(true);
        try {
            const [ordersRes, shiftsRes] = await Promise.all([
                db.kitchenOrders(venueId),
                db.activeShiftsByVenue(venueId),
            ]);
            const rows = ordersRes.data;
            if (ordersRes.error || !rows) return;

            const activeStaffIds = new Set((shiftsRes.data ?? []).map((s: any) => s.staff_id));

            // Shift-scoped orders: only show tickets created during the active shift
            const shiftStartTime = activeShift?.startedAt ? new Date(activeShift.startedAt).getTime() : 0;
            const filteredRows = shiftStartTime
                ? rows.filter((r: any) => new Date(r.created_at).getTime() >= shiftStartTime)
                : rows;

            // Waiter names map
            const waiterIds = Array.from(
                new Set(filteredRows.map((r: any) => (Array.isArray(r.bills) ? r.bills[0] : r.bills)?.waiter_id).filter((id): id is string => !!id)),
            );
            const { data: staffRows } = await db.staffNamesByIds(waiterIds);
            const waiterMap: Record<string, string> = {};
            for (const s of staffRows ?? []) waiterMap[s.id] = s.name;

            const mapped: BarTicket[] = filteredRows.map((r: any) => {
                const bill = Array.isArray(r.bills) ? r.bills[0] : r.bills;
                const table = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
                const billStatus = bill?.status || "open";

                // If parent bill was cancelled, mark status as cancelled
                let effectiveStatus = r.status;
                if (billStatus === "cancelled" && effectiveStatus !== "served") {
                    effectiveStatus = "cancelled";
                }

                const items: TicketItem[] = (r.order_items || []).map((it: any) => {
                    const matchedProduct = products.find(
                        (p: DbProduct) => p.id === it.product_id || p.name.toLowerCase() === (it.product_name || "").toLowerCase()
                    ) || FALLBACK_DRINKS.find(
                        f => f.id === it.product_id || f.name.toLowerCase() === (it.product_name || "").toLowerCase()
                    );
                    const unitPrice = Number(it.unit_price ?? matchedProduct?.price ?? 0);
                    const quantity = Number(it.quantity || 1);
                    const lineTotal = Number(it.line_total ?? (unitPrice * quantity));

                    return {
                        productId: it.product_id || matchedProduct?.id,
                        name: it.product_name,
                        quantity,
                        unitPrice,
                        lineTotal,
                        notes: it.notes || null,
                    };
                });

                const totalAmount = items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);

                const billWaiterId = bill?.waiter_id || null;
                const isWaiterOnDuty = billWaiterId ? activeStaffIds.has(billWaiterId) : false;
                const waiterName = isWaiterOnDuty && billWaiterId ? (waiterMap[billWaiterId] || "Staff") : "Unassigned";

                return {
                    id: r.id,
                    submissionId: r.id,
                    billId: r.bill_id,
                    billStatus,
                    tableNumber: table?.table_number ?? 0,
                    tableLabel: table?.table_label || `Table ${table?.table_number || "?"}`,
                    waiterId: billWaiterId,
                    waiterName,
                    guestName: r.guest_name || "Guest",
                    status: effectiveStatus,
                    placedAt: r.created_at,
                    notes: r.notes || null,
                    items,
                    totalAmount,
                };
            });

            setRawTickets(mapped);
        } catch (err) {
            console.error("Failed to load bar orders:", err);
        } finally {
            setLoadingTickets(false);
        }
    }, [venueId, products, activeShift?.startedAt]);

    useEffect(() => {
        void loadTickets();
    }, [loadTickets]);

    // Realtime listeners for incoming orders, table closures, and item updates
    const venueReady = Boolean(venueId && venueId !== "00000000-0000-0000-0000-000000000000");
    useRealtime({
        table: "order_submissions",
        filter: `venue_id=eq.${venueId}`,
        enabled: venueReady,
        onInsert: loadTickets,
        onUpdate: loadTickets,
        onDelete: loadTickets,
    });

    useRealtime({
        table: "bills",
        filter: `venue_id=eq.${venueId}`,
        enabled: venueReady,
        onInsert: loadTickets,
        onUpdate: loadTickets,
        onDelete: loadTickets,
    });

    useRealtime({
        table: "order_items",
        enabled: venueReady,
        onInsert: loadTickets,
        onUpdate: loadTickets,
        onDelete: loadTickets,
    });

    // Active tickets awaiting pouring (FIFO)
    const activeTickets = useMemo(() => {
        return rawTickets
            .filter(t => (t.status === "pending" || t.status === "confirmed" || t.status === "preparing") && t.billStatus !== "cancelled" && t.billStatus !== "closed")
            .sort((a, b) => {
                const timeA = Date.parse(a.placedAt) || 0;
                const timeB = Date.parse(b.placedAt) || 0;
                return timeA - timeB;
            });
    }, [rawTickets]);

    // Inactive tickets: Served / Ready / Cancelled / Table Ended (LIFO: newest first at bottom)
    const inactiveTickets = useMemo(() => {
        return rawTickets
            .filter(t => t.status === "ready" || t.status === "served" || t.status === "cancelled" || t.billStatus === "cancelled" || t.billStatus === "closed")
            .sort((a, b) => {
                const timeA = Date.parse(a.placedAt) || 0;
                const timeB = Date.parse(b.placedAt) || 0;
                return timeB - timeA;
            });
    }, [rawTickets]);

    // Combined queue: Active orders at top, greyed out finished/cancelled at bottom
    const allDisplayTickets = useMemo(() => {
        return [...activeTickets, ...inactiveTickets];
    }, [activeTickets, inactiveTickets]);

    // Dispense action: "SERVED ✓"
    const handleDispenseTicket = async (ticket: BarTicket) => {
        try {
            await db.setOrderStatus(ticket.submissionId, "served", staffId);

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
            toast.success(`Served for ${ticket.tableLabel}!`, { icon: "🍹" });
            void loadTickets();
        } catch (err) {
            console.error("Failed to dispense ticket:", err);
            toast.error("Could not update ticket. Please try again.");
        }
    };


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
            const direct = (activeShift.directAdjustments?.[p.id] ?? 0);
            const remaining = Math.max(0, opening + added - drawn - direct);

            return {
                ...p,
                opening,
                added,
                drawn,
                direct,
                remaining,
            };
        });
    }, [activeShift, barProducts]);

    // ──────────────────────────────────────────────────────────────────────────
    // END OF SHIFT & AUDIT STATE (Scene 3 / Tab 3)
    // ──────────────────────────────────────────────────────────────────────────
    const [auditSubTab, setAuditSubTab] = useState<"STOCK" | "CASHFLOW">("STOCK");
    const [expandedWaiters, setExpandedWaiters] = useState<Set<string>>(new Set());
    const [closingCounts, setClosingCounts] = useState<Record<string, number>>({});
    const [closingCashCount, setClosingCashCount] = useState<string>("");
    const [handoverNotes, setHandoverNotes] = useState<string>("");
    const [auditSearch, setAuditSearch] = useState<string>("");
    const [loadingShiftAudit, setLoadingShiftAudit] = useState(false);
    const [shiftAuditData, setShiftAuditData] = useState<{
        payments: any[];
        bills: any[];
        submissions: any[];
        staff: any[];
    }>({ payments: [], bills: [], submissions: [], staff: [] });

    // Open End Shift view
    const handleOpenEndShift = () => {
        setActiveTab("REPORT");
    };

    const handleAdjustDirectSale = (productId: string, delta: number) => {
        if (!activeShift) return;
        const current = activeShift.directAdjustments?.[productId] ?? 0;
        const nextVal = Math.max(0, current + delta);
        const nextMap = {
            ...(activeShift.directAdjustments || {}),
            [productId]: nextVal,
        };
        const updated = {
            ...activeShift,
            directAdjustments: nextMap,
        };
        persistShift(updated);
    };

    const loadShiftAuditData = useCallback(async () => {
        if (!venueId || !activeShift?.startedAt) return;
        setLoadingShiftAudit(true);
        try {
            const res = await db.shiftReportData(venueId, activeShift.startedAt);
            setShiftAuditData({
                payments: res.payments || [],
                bills: res.bills || [],
                submissions: res.submissions || [],
                staff: res.staff || [],
            });
        } catch (err) {
            console.error("Failed to load shift audit data:", err);
        } finally {
            setLoadingShiftAudit(false);
        }
    }, [venueId, activeShift?.startedAt]);

    useEffect(() => {
        if (activeTab === "REPORT") {
            void loadShiftAuditData();
        }
    }, [activeTab, loadShiftAuditData]);

    useRealtime({
        table: "payments",
        filter: `venue_id=eq.${venueId}`,
        enabled: venueReady,
        onInsert: () => { if (activeTab === "REPORT") void loadShiftAuditData(); },
        onUpdate: () => { if (activeTab === "REPORT") void loadShiftAuditData(); },
    });
    useRealtime({
        table: "bills",
        filter: `venue_id=eq.${venueId}`,
        enabled: venueReady,
        onInsert: () => { if (activeTab === "REPORT") void loadShiftAuditData(); },
        onUpdate: () => { if (activeTab === "REPORT") void loadShiftAuditData(); },
    });

    // Waiter audit groups
    const waiterAuditGroups = useMemo(() => {
        const staffMap = new Map<string, any>();
        (shiftAuditData.staff || []).forEach(s => staffMap.set(s.id, s));

        const paymentByBillMap = new Map<string, any[]>();
        (shiftAuditData.payments || []).forEach(p => {
            if (!p.bill_id) return;
            const list = paymentByBillMap.get(p.bill_id) || [];
            list.push(p);
            paymentByBillMap.set(p.bill_id, list);
        });

        const billMap = new Map<string, any>();
        (shiftAuditData.bills || []).forEach(b => billMap.set(b.id, b));

        const groups: Record<string, {
            waiterId: string;
            waiterName: string;
            waiterRole: string;
            totalAmount: number;
            cashAmount: number;
            momoAmount: number;
            cardAmount: number;
            unsettledAmount: number;
            orders: Array<{
                id: string;
                billId: string | null;
                tableLabel: string;
                createdAt: string;
                items: Array<{ name: string; quantity: number; lineTotal: number }>;
                totalAmount: number;
                paymentMethod: "cash" | "mobile_money" | "card" | "none";
                paymentStatus: "paid" | "unsettled" | "cancelled";
            }>;
        }> = {};

        (shiftAuditData.submissions || []).forEach(sub => {
            const bill = sub.bill_id ? billMap.get(sub.bill_id) || sub.bills : sub.bills;
            const waiterId = bill?.waiter_id || "unassigned";
            const staffObj = waiterId !== "unassigned" ? staffMap.get(waiterId) : null;
            const waiterName = staffObj ? staffObj.name : "Direct Bar / Walk-ins";
            const waiterRole = staffObj ? (staffObj.role || "Staff") : "Walk-in";

            if (!groups[waiterId]) {
                groups[waiterId] = {
                    waiterId,
                    waiterName,
                    waiterRole,
                    totalAmount: 0,
                    cashAmount: 0,
                    momoAmount: 0,
                    cardAmount: 0,
                    unsettledAmount: 0,
                    orders: [],
                };
            }

            const tablesObj = Array.isArray(bill?.tables) ? bill?.tables[0] : bill?.tables;
            const tableLabel = tablesObj?.table_label
                ? String(tablesObj.table_label)
                : tablesObj?.table_number
                ? `Table ${tablesObj.table_number}`
                : "Walk-in Zone";

            const rawItems: any[] = sub.order_items || [];
            const items = rawItems.map(it => ({
                name: it.product_name,
                quantity: Number(it.quantity || 1),
                lineTotal: Number(it.line_total || 0),
            }));

            const subTotal = items.reduce((sum, it) => sum + it.lineTotal, 0);

            const billPayments = sub.bill_id ? paymentByBillMap.get(sub.bill_id) || [] : [];
            let paymentMethod: "cash" | "mobile_money" | "card" | "none" = "none";
            let paymentStatus: "paid" | "unsettled" | "cancelled" = (bill?.status === "paid" || sub.status === "served") ? "paid" : "unsettled";

            if (billPayments.length > 0) {
                const primary = billPayments[0];
                const methodStr = (primary.method || "").toLowerCase();
                if (methodStr.includes("cash")) paymentMethod = "cash";
                else if (methodStr.includes("momo") || methodStr.includes("mobile")) paymentMethod = "mobile_money";
                else if (methodStr.includes("card") || methodStr.includes("pos")) paymentMethod = "card";
                paymentStatus = "paid";
            }

            groups[waiterId].totalAmount += subTotal;
            if (paymentMethod === "cash") groups[waiterId].cashAmount += subTotal;
            else if (paymentMethod === "mobile_money") groups[waiterId].momoAmount += subTotal;
            else if (paymentMethod === "card") groups[waiterId].cardAmount += subTotal;
            else groups[waiterId].unsettledAmount += subTotal;

            groups[waiterId].orders.push({
                id: sub.id,
                billId: sub.bill_id,
                tableLabel,
                createdAt: sub.created_at,
                items,
                totalAmount: subTotal,
                paymentMethod,
                paymentStatus,
            });
        });

        return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [shiftAuditData]);

    // Overall shift audit summary totals
    const auditSummaryTotals = useMemo(() => {
        let totalOrders = 0;
        let totalItems = 0;
        let totalRevenue = 0;
        let cashRevenue = 0;
        let momoRevenue = 0;
        let cardRevenue = 0;
        let unsettledRevenue = 0;

        waiterAuditGroups.forEach(g => {
            totalOrders += g.orders.length;
            totalRevenue += g.totalAmount;
            cashRevenue += g.cashAmount;
            momoRevenue += g.momoAmount;
            cardRevenue += g.cardAmount;
            unsettledRevenue += g.unsettledAmount;
            g.orders.forEach(o => {
                totalItems += o.items.reduce((s, i) => s + i.quantity, 0);
            });
        });

        const startingFloat = activeShift?.startingFloat || 0;
        const expectedCashInTill = startingFloat + cashRevenue;
        const countedCashNum = parseFloat(closingCashCount) || 0;
        const cashVariance = closingCashCount ? (countedCashNum - expectedCashInTill) : 0;

        return {
            totalOrders,
            totalItems,
            totalRevenue,
            cashRevenue,
            momoRevenue,
            cardRevenue,
            unsettledRevenue,
            startingFloat,
            expectedCashInTill,
            countedCashNum,
            cashVariance,
        };
    }, [waiterAuditGroups, activeShift?.startingFloat, closingCashCount]);

    const toggleWaiterAccordion = (waiterId: string) => {
        setExpandedWaiters(prev => {
            const next = new Set(prev);
            if (next.has(waiterId)) next.delete(waiterId);
            else next.add(waiterId);
            return next;
        });
    };

    const handleConfirmCloseShift = async () => {
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
            closingCashCounted: parseFloat(closingCashCount) || undefined,
            handoverNotes: handoverNotes.trim() || undefined,
            summaryTotals: {
                totalOrders: auditSummaryTotals.totalOrders,
                totalRevenue: auditSummaryTotals.totalRevenue,
                cashRevenue: auditSummaryTotals.cashRevenue,
                momoRevenue: auditSummaryTotals.momoRevenue,
                cardRevenue: auditSummaryTotals.cardRevenue,
            },
        };

        if (activeShift.id) {
            try {
                await db.endBarShift(activeShift.id, finalShift);
            } catch (e) {
                console.error("Error ending bar shift in DB:", e);
            }
        }

        // Close all active customer sessions, open bills, and pending orders for this venue
        try {
            await Promise.all([
                supabase
                    .from('customer_sessions')
                    .update({ status: 'closed' })
                    .eq('venue_id', venueId)
                    .eq('status', 'active'),
                supabase
                    .from('bills')
                    .update({ status: 'closed', closed_at: new Date().toISOString() })
                    .eq('venue_id', venueId)
                    .in('status', ['open', 'settling'])
                    .is('closed_at', null),
                supabase
                    .from('order_submissions')
                    .update({ status: 'cancelled' })
                    .eq('venue_id', venueId)
                    .in('status', ['pending', 'confirmed', 'preparing', 'ready']),
            ]);
        } catch { /* noop */ }

        try {
            const historyRaw = localStorage.getItem(`nightos:bar_shifts_history:${venueId}`) || "[]";
            const history = JSON.parse(historyRaw);
            history.unshift(finalShift);
            localStorage.setItem(`nightos:bar_shifts_history:${venueId}`, JSON.stringify(history.slice(0, 30)));
        } catch { /* noop */ }

        persistShift(null);
        setRawTickets([]);
        setRecentlyPoured([]);
        toast.success("Station Shift closed & table ordering locked. Handover complete!", { icon: "✅" });

        // Destroy session entirely and redirect to login screen
        if (onSignOut) {
            onSignOut();
        } else {
            try {
                await signOut();
            } finally {
                window.location.href = "/login";
            }
        }
    };

    if (loadingShift) {
        return (
            <div className="min-h-screen bg-[#F4F3E8] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 animate-pulse">
                    <ArrowPathIcon className="h-7 w-7 text-[#1A110B] animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#606F69]">
                        Checking Bar Shift Status...
                    </span>
                </div>
            </div>
        );
    }

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
    return (
        <div className="min-h-screen bg-[#F4F3E8] text-[#1A110B] font-sans antialiased flex flex-col">
            {/* ═══════════════════════════════════════════════════════════
               TOP STATION NAVIGATION HEADER
               ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-[#1A110B] text-white shadow-md border-b border-white/10 px-4 sm:px-6 py-2.5 space-y-2">
                {/* Top Row: Station Brand Info & End Shift */}
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <BysenIcon size="sm" />
                        <div className="min-w-0">
                            <h1 className="font-black text-sm sm:text-base tracking-tight text-white truncate">Main Bar Station</h1>
                            {staffName && (
                                <p className="text-[11px] text-white/60 font-medium leading-none mt-0.5 truncate">{staffName}</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenEndShift}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                            activeTab === "REPORT"
                                ? "bg-rose-500 text-white border-rose-400 shadow-xs"
                                : "bg-rose-600/20 hover:bg-rose-600/30 border-rose-500/40 text-rose-300"
                        }`}
                    >
                        End Shift
                    </button>
                </div>

                {/* Bottom Row: Dedicated Page Toggles (Moved down so it never obscures the logo/name) */}
                <div className="max-w-7xl mx-auto flex items-center">
                    <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto p-1 bg-white/[0.08] rounded-xl border border-white/10">
                        <button
                            type="button"
                            onClick={() => setActiveTab("QUEUE")}
                            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === "QUEUE"
                                    ? "bg-white text-[#1A110B] shadow-sm"
                                    : "text-white/70 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            <ClipboardDocumentListIcon className="h-4 w-4 shrink-0" />
                            <span>Orders</span>
                            {activeTickets.length > 0 && (
                                <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-black ${
                                    activeTab === "QUEUE" ? "bg-[#1A110B] text-white" : "bg-white/20 text-white"
                                }`}>
                                    {activeTickets.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("STOCK")}
                            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === "STOCK"
                                    ? "bg-white text-[#1A110B] shadow-sm"
                                    : "text-white/70 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            <ArchiveBoxIcon className="h-4 w-4 shrink-0" />
                            <span>Stock & Restock</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
               TAB 1: DRINK DISPENSE QUEUE (High-Speed Single Ticket Stream)
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "QUEUE" && (
                <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-5">
                    {/* Orders Queue List */}
                    {allDisplayTickets.length === 0 ? (
                        <div className="rounded-xl bg-white p-12 border border-[#1A110B]/10 text-center space-y-2 shadow-sm">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-lg font-bold">
                                ✓
                            </div>
                            <h3 className="font-bold text-base text-[#1A110B]">All Table Drinks Dispensed!</h3>
                            <p className="text-xs text-[#606F69] max-w-sm mx-auto">
                                The bar queue is clear. New drink tickets submitted by table waiters will stream in automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allDisplayTickets.map(ticket => {
                                const waitMins = Math.floor((Date.now() - new Date(ticket.placedAt).getTime()) / 60000);
                                const isUrgent = waitMins >= 8;
                                const isActive = (ticket.status === "pending" || ticket.status === "confirmed" || ticket.status === "preparing") && ticket.billStatus !== "cancelled" && ticket.billStatus !== "closed";
                                const isCancelled = ticket.status === "cancelled" || ticket.billStatus === "cancelled";
                                const isTableEnded = ticket.billStatus === "closed" && !isCancelled;
                                const isServed = ticket.status === "served" || ticket.status === "ready";

                                return (
                                    <div
                                        key={ticket.id}
                                        className={`rounded-xl p-4 sm:p-5 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                            isActive
                                                ? isUrgent
                                                    ? "bg-white border-rose-300 shadow-sm"
                                                    : "bg-white border-[#1A110B]/10 hover:border-[#1A110B]/20 shadow-sm"
                                                : "bg-white/60 border-slate-200/80 opacity-60"
                                        }`}
                                    >
                                        {/* Ticket Details */}
                                        <div className="space-y-2 min-w-0 flex-1">
                                            {/* Top info */}
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-tight ${
                                                    isActive ? "bg-[#1A110B] text-white" : "bg-slate-700 text-white"
                                                }`}>
                                                    {ticket.tableLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1A110B]">
                                                    <UserIcon className="h-3.5 w-3.5 text-[#606F69]" />
                                                    <span>{ticket.waiterName}</span>
                                                </span>
                                                {isActive && (
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                                            isUrgent
                                                                ? "bg-rose-50 text-rose-800 border border-rose-200/60"
                                                                : "bg-[#1A110B]/5 text-[#606F69]"
                                                        }`}
                                                    >
                                                        {waitMins === 0 ? "Just now" : `${waitMins}m ago`}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-mono text-[#606F69]">
                                                    #{ticket.id.slice(0, 8)}
                                                </span>
                                                {!isActive && (
                                                    <span className="text-[10px] text-[#606F69]">
                                                        {new Date(ticket.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Itemized drink lines */}
                                            <div className="flex flex-wrap gap-2 pt-0.5">
                                                {ticket.items.map((it, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                                                            isActive
                                                                ? "bg-[#1A110B]/[0.03] text-[#1A110B] border-[#1A110B]/10"
                                                                : "bg-slate-50 text-slate-700 border-slate-200"
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold">×{it.quantity}</span>
                                                        <span>{it.name}</span>
                                                        {(it.lineTotal ?? 0) > 0 && (
                                                            <span className="text-xs font-mono font-bold text-[#1A110B] tabular-nums">
                                                                · {formatGHS(it.lineTotal ?? 0)}
                                                            </span>
                                                        )}
                                                        {it.notes && (
                                                            <span className="text-[10px] font-normal italic text-[#606F69]">
                                                                ({it.notes})
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {ticket.notes && (
                                                <div className="text-xs italic text-[#1A110B] bg-[#1A110B]/[0.03] rounded-lg p-2 border border-[#1A110B]/8">
                                                    Order Note: "{ticket.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Action / Status Pill */}
                                        <div className="shrink-0">
                                            {isActive ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDispenseTicket(ticket)}
                                                    className="w-full sm:w-auto rounded-xl bg-[#1A110B] hover:bg-[#1A110B]/90 text-white px-6 py-2.5 text-xs font-bold tracking-wide shadow-sm transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                                >
                                                    <span>✓ SERVED</span>
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {isCancelled && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/60 px-3 py-1 text-xs font-bold text-rose-800">
                                                            ✕ Cancelled
                                                        </span>
                                                    )}
                                                    {isTableEnded && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                                                            Table Ended
                                                        </span>
                                                    )}
                                                    {isServed && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1 text-xs font-bold text-emerald-800">
                                                            ✓ Served
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
               TAB 3: BESPOKE BAR SHIFT RECONCILIATION & WAITER AUDIT
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "REPORT" && (
                <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
                    {/* Header: Title */}
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#606F69]">
                            Station Closing Reconciliation
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight text-[#1A110B] mt-0.5">
                            Shift Report & Waiter Audit
                        </h2>
                        <p className="text-xs text-[#606F69] mt-1">
                            Shift started at {activeShift ? new Date(activeShift.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} by {activeShift?.startedByStaffName || "Bartender"}.
                        </p>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════════════════
                       TOP SUMMARY KPI STRIP (MATCHING MANAGER SHIFT REPORT CARDS)
                       ═══════════════════════════════════════════════════════════════════════════ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Shift Revenue */}
                        <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[135px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                                    Shift Revenue
                                </span>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                                    <CurrencyDollarIcon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-2 min-w-0">
                                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                                    {formatGHS(auditSummaryTotals.totalRevenue)}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                                    <span className="truncate">{auditSummaryTotals.totalOrders} {auditSummaryTotals.totalOrders === 1 ? "order" : "orders"} placed</span>
                                    <span className="shrink-0">{auditSummaryTotals.totalItems} drinks poured</span>
                                </div>
                            </div>
                        </div>

                        {/* Expected Till Cash */}
                        <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[135px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                                    Expected Till Cash
                                </span>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                                    <BanknotesIcon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-2 min-w-0">
                                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                                    {formatGHS(auditSummaryTotals.expectedCashInTill)}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                                    <span className="truncate">Float {formatGHS(auditSummaryTotals.startingFloat)}</span>
                                    <span className="shrink-0 font-semibold text-[#1A110B]/80">+ Cash Sales</span>
                                </div>
                            </div>
                        </div>

                        {/* Cash Handed In */}
                        <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[135px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                                    Cash Handed In
                                </span>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                                    <BanknotesIcon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-2 min-w-0">
                                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                                    {formatGHS(auditSummaryTotals.cashRevenue)}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                                    <span className="truncate">{auditSummaryTotals.totalRevenue > 0 ? ((auditSummaryTotals.cashRevenue / auditSummaryTotals.totalRevenue) * 100).toFixed(1) : "0.0"}% of total</span>
                                    <span className="shrink-0 font-semibold text-[#1A110B]/80">Physical Cash</span>
                                </div>
                            </div>
                        </div>

                        {/* Digital Payments */}
                        <div className="rounded-xl bg-white p-5 border border-[#1A110B]/10 shadow-sm flex flex-col justify-between min-w-0 h-full min-h-[135px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#606F69] truncate mr-2">
                                    Digital Payments
                                </span>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A110B]/5 text-[#1A110B] shrink-0">
                                    <CreditCardIcon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-2 min-w-0">
                                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A110B] tabular-nums truncate">
                                    {formatGHS(auditSummaryTotals.momoRevenue + auditSummaryTotals.cardRevenue)}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-[#606F69] gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                                    <span className="truncate">MoMo {formatGHS(auditSummaryTotals.momoRevenue)}</span>
                                    <span className="shrink-0 font-semibold text-[#1A110B]/80">Card {formatGHS(auditSummaryTotals.cardRevenue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Sub-Tabs Toggle */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white rounded-xl p-1.5 sm:p-2 border border-[#1A110B]/10 shadow-sm">
                        <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center">
                            <button
                                type="button"
                                onClick={() => setAuditSubTab("STOCK")}
                                className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
                                    auditSubTab === "STOCK"
                                        ? "bg-[#1A110B] text-white shadow-sm"
                                        : "text-[#1A110B] hover:bg-[#1A110B]/5"
                                }`}
                            >
                                <ArchiveBoxIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">Beverage Stock</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAuditSubTab("CASHFLOW")}
                                className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
                                    auditSubTab === "CASHFLOW"
                                        ? "bg-[#1A110B] text-white shadow-sm"
                                        : "text-[#1A110B] hover:bg-[#1A110B]/5"
                                }`}
                            >
                                <BanknotesIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">Waiter Ledger</span>
                                {waiterAuditGroups.length > 0 && (
                                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0 ${
                                        auditSubTab === "CASHFLOW" ? "bg-white/20 text-white" : "bg-[#1A110B]/10 text-[#1A110B]"
                                    }`}>
                                        {waiterAuditGroups.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ─────────────────────────────────────────────────────────────
                        VIEW 1: INVENTORY & BOTTLE DEPLETION RECONCILIATION
                       ───────────────────────────────────────────────────────────── */}
                    {auditSubTab === "STOCK" && (
                        <div className="space-y-4">
                            {/* Inventory Table */}
                            <div className="rounded-xl bg-white border border-[#1A110B]/10 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-[#1A110B]/[0.03] border-b border-[#1A110B]/10 text-xs font-bold text-[#606F69] uppercase tracking-wider">
                                                <th className="p-3.5">Beverage Item</th>
                                                <th className="p-3.5 text-center">Start</th>
                                                <th className="p-3.5 text-center">Restock</th>
                                                <th className="p-3.5 text-center">Tables (Auto)</th>
                                                <th className="p-3.5 text-center">Walk-Up Adjust</th>
                                                <th className="p-3.5 text-center font-black text-[#1A110B]">Expected</th>
                                                <th className="p-3.5 text-center">Physical Count</th>
                                                <th className="p-3.5 text-right">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1A110B]/10">
                                            {liveStockTable.map(item => {
                                                const expected = item.remaining;
                                                const counted = closingCounts[item.id] ?? expected;
                                                const diff = counted - expected;
                                                const hasTableDeduction = item.drawn > 0;

                                                return (
                                                    <tr key={item.id} className="hover:bg-[#1A110B]/[0.02] transition">
                                                        <td className="p-3.5 font-bold text-[#1A110B]">
                                                            <div className="text-sm font-bold text-[#1A110B]">{item.name}</div>
                                                            <div className="text-[11px] font-medium text-[#606F69] mt-0.5">{item.category}</div>
                                                        </td>
                                                        <td className="p-3.5 text-center font-bold text-[14px] sm:text-[15px] text-[#1A110B] tabular-nums">
                                                            {item.opening}
                                                        </td>
                                                        <td className="p-3.5 text-center font-bold text-[14px] sm:text-[15px] tabular-nums">
                                                            {item.added > 0 ? (
                                                                <span className="text-emerald-700 font-black">+{item.added}</span>
                                                            ) : (
                                                                <span className="text-[#606F69]/60 font-semibold">+0</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3.5 text-center tabular-nums">
                                                            {hasTableDeduction ? (
                                                                <span className="inline-flex items-center justify-center font-black text-[14px] sm:text-[15px] text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200/70">
                                                                    −{item.drawn}
                                                                </span>
                                                            ) : (
                                                                <span className="font-semibold text-[14px] sm:text-[15px] text-[#606F69]/60">
                                                                    −0
                                                                </span>
                                                            )}
                                                        </td>
                                                        
                                                        {/* Walk-up Quick Adjust Controls */}
                                                        <td className="p-3.5 text-center">
                                                            <div className="inline-flex items-center gap-1.5 bg-[#1A110B]/5 border border-[#1A110B]/10 rounded-lg p-1 shadow-2xs">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustDirectSale(item.id, -1)}
                                                                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-md bg-white hover:bg-white/80 text-[#1A110B] flex items-center justify-center font-black text-sm shadow-xs cursor-pointer active:scale-95 transition"
                                                                    title="Decrease Walk-up"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className={`font-black text-[14px] sm:text-[15px] px-2 tabular-nums ${item.direct > 0 ? "text-[#1A110B]" : "text-[#606F69]/70"}`}>
                                                                    {item.direct}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustDirectSale(item.id, 1)}
                                                                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-md bg-white hover:bg-white/80 text-[#1A110B] flex items-center justify-center font-black text-sm shadow-xs cursor-pointer active:scale-95 transition"
                                                                    title="Increase Walk-up"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </td>

                                                        <td className="p-3.5 text-center font-black text-[15px] sm:text-[16px] text-[#1A110B] tabular-nums">
                                                            {expected}
                                                        </td>

                                                        {/* Physical Count Input */}
                                                        <td className="p-3.5 text-center">
                                                            <input
                                                                type="number"
                                                                value={counted}
                                                                onChange={e => setClosingCounts({ ...closingCounts, [item.id]: Number(e.target.value) })}
                                                                className="w-18 sm:w-20 rounded-lg border border-[#1A110B]/20 bg-white py-1.5 text-center font-black text-[14px] sm:text-[15px] text-[#1A110B] tabular-nums shadow-xs focus:ring-2 focus:ring-[#1A110B]/20 focus:outline-none"
                                                            />
                                                        </td>

                                                        {/* Variance Pill */}
                                                        <td className="p-3.5 text-right">
                                                            {diff !== 0 ? (
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                                                    diff < 0
                                                                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                                                                        : "bg-amber-50 text-amber-800 border border-amber-200"
                                                                }`}>
                                                                    {diff > 0 ? `+${diff} Over` : `${diff} Short`}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                    ✓ Balanced
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        VIEW 2: CASH FLOW & WAITER TABLE AUDIT ACCORDION LEDGER
                       ───────────────────────────────────────────────────────────── */}
                    {auditSubTab === "CASHFLOW" && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#1A110B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                <div>
                                    <h3 className="text-sm font-bold text-[#1A110B]">
                                        Staff & Table Billing Collections Audit
                                    </h3>
                                    <p className="text-xs text-[#606F69] mt-0.5">
                                        Click any waiter card to expand and audit every individual transaction, payment channel, and table bill.
                                    </p>
                                </div>
                                <div className="flex items-center rounded-xl bg-[#1A110B]/5 px-3 py-2 border border-[#1A110B]/10 text-xs">
                                    <MagnifyingGlassIcon className="h-4 w-4 text-[#606F69] mr-2" />
                                    <input
                                        type="text"
                                        placeholder="Filter staff or table..."
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                        className="bg-transparent text-xs font-medium text-[#1A110B] focus:outline-none w-36 sm:w-44 placeholder:text-[#606F69]"
                                    />
                                    {auditSearch && (
                                        <button onClick={() => setAuditSearch("")} className="text-[#606F69] hover:text-[#1A110B]">
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Waiter Cards Accordion List */}
                            {waiterAuditGroups.length === 0 ? (
                                <div className="rounded-xl bg-white p-12 border border-[#1A110B]/10 text-center space-y-2 shadow-sm">
                                    <CheckBadgeIcon className="h-10 w-10 text-[#606F69]/40 mx-auto" />
                                    <h3 className="font-bold text-sm text-[#1A110B]">No Table Transactions Logged Yet</h3>
                                    <p className="text-xs text-[#606F69] max-w-sm mx-auto">
                                        Orders placed by waiters during this active shift will automatically stream into this audit ledger.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {waiterAuditGroups
                                        .filter(g => !auditSearch || g.waiterName.toLowerCase().includes(auditSearch.toLowerCase()) || g.orders.some(o => o.tableLabel.toLowerCase().includes(auditSearch.toLowerCase())))
                                        .map(waiter => {
                                            const isExpanded = expandedWaiters.has(waiter.waiterId);

                                            return (
                                                <div
                                                    key={waiter.waiterId}
                                                    className="rounded-xl bg-white border border-[#1A110B]/10 shadow-sm overflow-hidden transition"
                                                >
                                                    {/* Accordion Card Header */}
                                                    <div
                                                        onClick={() => toggleWaiterAccordion(waiter.waiterId)}
                                                        className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#1A110B]/[0.02] select-none transition"
                                                    >
                                                        {/* Left: Waiter Name & Info */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-9 w-9 rounded-full bg-[#1A110B]/5 text-[#1A110B] border border-[#1A110B]/10 flex items-center justify-center font-bold text-xs shrink-0">
                                                                {waiter.waiterName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-[#1A110B] truncate">
                                                                        {waiter.waiterName}
                                                                    </span>
                                                                    <span className="rounded-md bg-[#1A110B]/5 px-2 py-0.5 text-[10px] font-semibold text-[#606F69] uppercase">
                                                                        {waiter.waiterRole}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-[#606F69] mt-0.5">
                                                                    {waiter.orders.length} orders served
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Total Handled + Payment Pills + Chevron */}
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className="text-right hidden sm:block">
                                                                <div className="text-sm font-bold font-mono text-[#1A110B] tabular-nums">
                                                                    {formatGHS(waiter.totalAmount)}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] font-semibold font-mono mt-0.5">
                                                                    {waiter.cashAmount > 0 && <span className="text-emerald-700">Cash {formatGHS(waiter.cashAmount)}</span>}
                                                                    {waiter.momoAmount > 0 && <span className="text-sky-700">MoMo {formatGHS(waiter.momoAmount)}</span>}
                                                                    {waiter.cardAmount > 0 && <span className="text-amber-700">Card {formatGHS(waiter.cardAmount)}</span>}
                                                                </div>
                                                            </div>

                                                            <div className="sm:hidden font-bold text-xs font-mono">
                                                                {formatGHS(waiter.totalAmount)}
                                                            </div>

                                                            <div className="rounded-lg bg-[#1A110B]/5 p-1.5 text-[#1A110B]">
                                                                {isExpanded ? (
                                                                    <ChevronUpIcon className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDownIcon className="h-4 w-4" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Content: Itemized Transactions Ledger */}
                                                    {isExpanded && (
                                                        <div className="border-t border-[#1A110B]/10 bg-[#1A110B]/[0.02] p-3 sm:p-4 space-y-2.5 animate-in fade-in duration-150">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#606F69] block">
                                                                Individual Order Tickets Served by {waiter.waiterName}
                                                            </span>

                                                            <div className="space-y-2">
                                                                {waiter.orders.map(ord => (
                                                                    <div
                                                                        key={ord.id}
                                                                        className="rounded-lg bg-white p-3.5 border border-[#1A110B]/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                                    >
                                                                        <div className="space-y-1.5 min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                                                                <span className="rounded-md bg-[#1A110B] text-white px-2 py-0.5 text-[10px] font-bold">
                                                                                    {ord.tableLabel}
                                                                                </span>
                                                                                <span className="font-mono text-[10px] text-[#606F69]">
                                                                                    #{ord.id.slice(0, 8)}
                                                                                </span>
                                                                                <span className="text-[10px] text-[#606F69]">
                                                                                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                                </span>
                                                                                
                                                                                {/* Payment Method Badge */}
                                                                                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase ${
                                                                                    ord.paymentMethod === "cash"
                                                                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                                                                                        : ord.paymentMethod === "mobile_money"
                                                                                        ? "bg-sky-50 text-sky-800 border border-sky-200/60"
                                                                                        : ord.paymentMethod === "card"
                                                                                        ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                                                                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                                                                }`}>
                                                                                    {ord.paymentMethod === "cash" && "💵 Cash"}
                                                                                    {ord.paymentMethod === "mobile_money" && "📱 Mobile Money"}
                                                                                    {ord.paymentMethod === "card" && "💳 Card"}
                                                                                    {ord.paymentMethod === "none" && "⏳ Unsettled"}
                                                                                </span>
                                                                            </div>

                                                                            {/* Items in ticket */}
                                                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                                                {ord.items.map((it, idx) => (
                                                                                    <span
                                                                                        key={idx}
                                                                                        className="rounded-lg bg-[#1A110B]/[0.03] px-2.5 py-1 text-xs font-medium text-[#1A110B] border border-[#1A110B]/8"
                                                                                    >
                                                                                        <span className="font-mono font-bold">×{it.quantity}</span> {it.name}
                                                                                        {it.lineTotal > 0 && (
                                                                                            <span className="text-[10px] font-mono font-semibold text-[#606F69] ml-1">
                                                                                                · {formatGHS(it.lineTotal)}
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        {/* Order Total */}
                                                                        <div className="text-right shrink-0">
                                                                            <span className="text-sm font-bold font-mono text-[#1A110B]">
                                                                                {formatGHS(ord.totalAmount)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        FINAL SHIFT HANDOVER & CLOSE SECTION
                       ───────────────────────────────────────────────────────────── */}
                    <div className="rounded-xl bg-white p-5 sm:p-6 border border-[#1A110B]/10 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-3">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#606F69]">
                                    Station Sign-Off
                                </span>
                                <h3 className="text-base font-bold text-[#1A110B]">
                                    Physical Till Count & Handover Sign-Off
                                </h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Cash Count */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[#1A110B] block">
                                    Counted Physical Cash in Drawer (GH₵)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#606F69]">GH₵</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={closingCashCount}
                                        onChange={e => setClosingCashCount(e.target.value)}
                                        className="w-full rounded-xl border border-[#1A110B]/15 bg-white py-2.5 pl-12 pr-3 text-sm font-bold text-[#1A110B] focus:ring-1 focus:ring-[#1A110B]"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="text-[#606F69]">Expected in Till:</span>
                                    <span className="font-mono font-bold text-[#1A110B]">
                                        {formatGHS(auditSummaryTotals.expectedCashInTill)}
                                    </span>
                                </div>
                                {closingCashCount && (
                                    <div className="flex items-center justify-between text-xs pt-0.5">
                                        <span className="text-[#606F69]">Till Variance:</span>
                                        <span className={`font-mono font-bold ${
                                            auditSummaryTotals.cashVariance === 0
                                                ? "text-emerald-700"
                                                : auditSummaryTotals.cashVariance < 0
                                                ? "text-rose-700"
                                                : "text-amber-700"
                                        }`}>
                                            {auditSummaryTotals.cashVariance === 0 ? (
                                                "✓ Balanced"
                                            ) : auditSummaryTotals.cashVariance > 0 ? (
                                                <span className="inline-flex items-baseline gap-1">
                                                    <span>+</span>
                                                    {formatGHS(auditSummaryTotals.cashVariance)}
                                                    <span>Over</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-baseline gap-1">
                                                    {formatGHS(auditSummaryTotals.cashVariance)}
                                                    <span>Short</span>
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Handover Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[#1A110B] block">
                                    Handover Notes for Next Shift / Supervisor (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. 2 bottles in ice bath, cash handed over to Shift Supervisor..."
                                    value={handoverNotes}
                                    onChange={e => setHandoverNotes(e.target.value)}
                                    className="w-full rounded-xl border border-[#1A110B]/15 bg-white p-2.5 text-xs font-medium text-[#1A110B] focus:ring-1 focus:ring-[#1A110B]"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-[#1A110B]/10">
                            <button
                                type="button"
                                onClick={() => setActiveTab("QUEUE")}
                                className="flex-1 rounded-xl bg-white border border-[#1A110B]/15 hover:bg-[#1A110B]/5 py-3 text-xs font-semibold text-[#1A110B] transition cursor-pointer"
                            >
                                Back to Drink Queue
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCloseShift}
                                className="flex-1 rounded-xl bg-[#1A110B] hover:bg-[#1A110B]/90 py-3 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                            >
                                Confirm & End Station Shift Handover
                            </button>
                        </div>
                    </div>
                </main>
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
        </div>
    );
}
