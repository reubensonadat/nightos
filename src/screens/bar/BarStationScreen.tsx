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

    // Load initial shift
    useEffect(() => {
        const init = async () => {
            if (!venueId) return;
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
                        tableNumber: table?.table_number ?? 0,
                        tableLabel: table?.table_label || `Table ${table?.table_number || "?"}`,
                        waiterId: billWaiterId,
                        waiterName,
                        guestName: r.guest_name || "Guest",
                        status: r.status,
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
    }, [venueId, products]);

    useEffect(() => {
        void loadTickets();
    }, [loadTickets]);

    // Realtime listener for incoming orders — disabled until the venue id is
    // resolved so we never subscribe to the whole table across all venues.
    const venueReady = Boolean(venueId && venueId !== "00000000-0000-0000-0000-000000000000");
    useRealtime({
        table: "order_submissions",
        filter: `venue_id=eq.${venueId}`,
        enabled: venueReady,
        onInsert: loadTickets,
        onUpdate: loadTickets,
        onDelete: loadTickets,
    });

    // Active tickets awaiting pouring
    const activeTickets = useMemo(() => {
        return rawTickets
            .filter(t => t.status === "pending" || t.status === "confirmed" || t.status === "preparing")
            .sort((a, b) => {
                const timeA = Date.parse(a.placedAt) || 0;
                const timeB = Date.parse(b.placedAt) || 0;
                return timeA - timeB;
            });
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
            toast.success(`Served for ${ticket.tableLabel}! Waiter notified.`, { icon: "🍹" });
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

        // Close all active customer sessions and open bills on tables for this venue
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
                    .is('closed_at', null)
            ]);
        } catch { /* noop */ }

        try {
            const historyRaw = localStorage.getItem(`nightos:bar_shifts_history:${venueId}`) || "[]";
            const history = JSON.parse(historyRaw);
            history.unshift(finalShift);
            localStorage.setItem(`nightos:bar_shifts_history:${venueId}`, JSON.stringify(history.slice(0, 30)));
        } catch { /* noop */ }

        persistShift(null);
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
            <header className="sticky top-0 z-30 bg-[#1A110B] text-white shadow-md border-b border-white/10 px-4 sm:px-6 py-3">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Station Brand */}
                    <div className="flex items-center justify-between md:justify-start gap-4">
                        <div className="flex items-center gap-3">
                            <BysenIcon size="sm" />
                            <div>
                                <h1 className="font-black text-sm tracking-tight text-white">Main Bar Station</h1>
                                {staffName && (
                                    <p className="text-[10px] text-white/60 font-medium leading-none mt-0.5">{staffName}</p>
                                )}
                            </div>
                        </div>

                        {/* Top End Shift Button (Mobile view) */}
                        <div className="flex md:hidden items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleOpenEndShift}
                                className="rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-300 px-2.5 py-1 text-xs font-bold cursor-pointer"
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
                                                        {(it.lineTotal ?? 0) > 0 && (
                                                            <span className="text-[14px] font-mono font-bold text-[#1A110B] tabular-nums">
                                                                · {formatGHS(it.lineTotal ?? 0)}
                                                            </span>
                                                        )}
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
                                            className="w-full sm:w-auto rounded-lg bg-[#1A110B] hover:bg-[#1A110B]/90 text-white px-6 py-3 text-xs font-black tracking-wide shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center cursor-pointer"
                                        >
                                            <span>✓ SERVED</span>
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
               TAB 3: BESPOKE BAR SHIFT RECONCILIATION & WAITER AUDIT
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "REPORT" && (
                <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
                    {/* Top Shift Financial Summary Banner */}
                    <div className="rounded-xl bg-[#1A110B] text-white p-5 sm:p-6 border border-white/10 shadow-lg space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                                    Station Closing Reconciliation
                                </span>
                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                                    End-of-Shift Reconciliation & Waiter Audit
                                </h2>
                                <p className="text-xs text-white/70 mt-1">
                                    Shift started at {activeShift ? new Date(activeShift.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} by {activeShift?.startedByStaffName || "Bartender"}.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void loadShiftAuditData()}
                                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 transition"
                            >
                                <ArrowPathIcon className={`h-3.5 w-3.5 ${loadingShiftAudit ? "animate-spin" : ""}`} />
                                <span>Refresh Ledger</span>
                            </button>
                        </div>

                        {/* Top Summary Metrics Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-white/5 p-3.5 border border-white/10 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                    Orders & Items Handled
                                </span>
                                <div className="text-lg sm:text-xl font-black text-white">
                                    {auditSummaryTotals.totalOrders} <span className="text-xs font-medium text-white/70">tickets</span>
                                </div>
                                <span className="text-[11px] font-mono text-emerald-400 font-bold block">
                                    {auditSummaryTotals.totalItems} total drinks poured
                                </span>
                            </div>

                            <div className="rounded-lg bg-white/5 p-3.5 border border-white/10 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                    Total System Revenue
                                </span>
                                <div className="text-lg sm:text-xl font-black text-white font-mono tabular-nums">
                                    {formatGHS(auditSummaryTotals.totalRevenue)}
                                </div>
                                <span className="text-[11px] text-white/70 block">
                                    Logged across all tables
                                </span>
                            </div>

                            <div className="rounded-lg bg-white/5 p-3.5 border border-white/10 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                    Payment Channels Split
                                </span>
                                <div className="text-xs font-mono space-y-0.5 pt-0.5">
                                    <div className="text-emerald-300 font-bold">💵 Cash: {formatGHS(auditSummaryTotals.cashRevenue)}</div>
                                    <div className="text-sky-300 font-bold">📱 MoMo: {formatGHS(auditSummaryTotals.momoRevenue)}</div>
                                    <div className="text-amber-300 font-bold">💳 Card: {formatGHS(auditSummaryTotals.cardRevenue)}</div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-white/5 p-3.5 border border-white/10 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                    Expected Till Cash
                                </span>
                                <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono tabular-nums">
                                    {formatGHS(auditSummaryTotals.expectedCashInTill)}
                                </div>
                                <span className="text-[10px] text-white/60 block">
                                    Float ({formatGHS(auditSummaryTotals.startingFloat)}) + Cash Sales
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Sub-Tabs Toggle: [Inventory Reconciliation] | [Cash Flow & Waiter Audit] */}
                    <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-2">
                        <div className="inline-flex rounded-lg bg-[#1A110B]/5 p-1 border border-[#1A110B]/10">
                            <button
                                type="button"
                                onClick={() => setAuditSubTab("STOCK")}
                                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition cursor-pointer ${
                                    auditSubTab === "STOCK"
                                        ? "bg-[#1A110B] text-white shadow-xs"
                                        : "text-[#1A110B]/70 hover:text-[#1A110B]"
                                }`}
                            >
                                <ArchiveBoxIcon className="h-4 w-4" />
                                <span>1. Beverage Stock Reconciliation</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAuditSubTab("CASHFLOW")}
                                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition cursor-pointer ${
                                    auditSubTab === "CASHFLOW"
                                        ? "bg-[#1A110B] text-white shadow-xs"
                                        : "text-[#1A110B]/70 hover:text-[#1A110B]"
                                }`}
                            >
                                <BanknotesIcon className="h-4 w-4" />
                                <span>2. Waiter Collections & Table Cash Flow</span>
                                {waiterAuditGroups.length > 0 && (
                                    <span className="rounded-md bg-white/20 text-current px-1.5 py-0.2 text-[10px] font-black">
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
                            <div className="bg-white p-4 rounded-lg border border-[#1A110B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div>
                                    <h3 className="text-sm font-black text-[#1A110B]">
                                        Bottle Depletion & Shelf Count-Out
                                    </h3>
                                    <p className="text-xs text-[#606F69]">
                                        Table orders are automatically deducted. Adjust walk-up sales and verify final physical shelf counts.
                                    </p>
                                </div>
                                <div className="text-[11px] font-bold text-[#1A110B] bg-[#F4F3E8] px-3 py-1.5 rounded-md border border-[#1A110B]/10">
                                    Formula: Start + Restock − Tables − Walk-ups = Expected
                                </div>
                            </div>

                            {/* Inventory Table */}
                            <div className="rounded-lg bg-white border border-[#1A110B]/10 shadow-xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-[#1A110B]/5 border-b border-[#1A110B]/10 text-[11px] font-black text-[#606F69] uppercase tracking-wider">
                                                <th className="p-3">Beverage Item</th>
                                                <th className="p-3 text-center">Start</th>
                                                <th className="p-3 text-center">Restock</th>
                                                <th className="p-3 text-center text-rose-700">Tables (Auto)</th>
                                                <th className="p-3 text-center">Walk-Up Adjust</th>
                                                <th className="p-3 text-center font-black text-[#1A110B]">Expected</th>
                                                <th className="p-3 text-center">Physical Count</th>
                                                <th className="p-3 text-right">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1A110B]/10">
                                            {liveStockTable.map(item => {
                                                const expected = item.remaining;
                                                const counted = closingCounts[item.id] ?? expected;
                                                const diff = counted - expected;

                                                return (
                                                    <tr key={item.id} className="hover:bg-[#F4F3E8]/40 transition">
                                                        <td className="p-3 font-bold text-[#1A110B]">
                                                            <div>{item.name}</div>
                                                            <div className="text-[10px] font-medium text-[#606F69]">{item.category}</div>
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-bold text-[#1A110B]">{item.opening}</td>
                                                        <td className="p-3 text-center font-mono font-bold text-emerald-700">+{item.added}</td>
                                                        <td className="p-3 text-center font-mono font-bold text-rose-700">−{item.drawn}</td>
                                                        
                                                        {/* Walk-up Quick Adjust Controls */}
                                                        <td className="p-3 text-center">
                                                            <div className="inline-flex items-center gap-1.5 bg-[#F4F3E8] border border-[#1A110B]/10 rounded-md p-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustDirectSale(item.id, -1)}
                                                                    className="h-5 w-5 rounded-sm bg-white hover:bg-[#1A110B]/10 text-[#1A110B] flex items-center justify-center font-black cursor-pointer"
                                                                    title="Decrease Walk-up"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="font-mono font-black text-xs px-1">
                                                                    {item.direct}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustDirectSale(item.id, 1)}
                                                                    className="h-5 w-5 rounded-sm bg-white hover:bg-[#1A110B]/10 text-[#1A110B] flex items-center justify-center font-black cursor-pointer"
                                                                    title="Increase Walk-up"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </td>

                                                        <td className="p-3 text-center font-mono font-black text-sm text-[#1A110B]">
                                                            {expected}
                                                        </td>

                                                        {/* Physical Count Input */}
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="number"
                                                                value={counted}
                                                                onChange={e => setClosingCounts({ ...closingCounts, [item.id]: Number(e.target.value) })}
                                                                className="w-16 rounded-md border border-[#1A110B]/20 py-1 text-center font-black text-xs tabular-nums focus:ring-1 focus:ring-[#1A110B]"
                                                            />
                                                        </td>

                                                        {/* Variance Pill */}
                                                        <td className="p-3 text-right">
                                                            {diff !== 0 ? (
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                                    diff < 0
                                                                        ? "bg-rose-100 text-rose-900 border border-rose-300"
                                                                        : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                                                }`}>
                                                                    {diff > 0 ? `+${diff} Over` : `${diff} Short`}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                            <div className="bg-white p-4 rounded-lg border border-[#1A110B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div>
                                    <h3 className="text-sm font-black text-[#1A110B]">
                                        Staff & Table Billing Collections Audit
                                    </h3>
                                    <p className="text-xs text-[#606F69]">
                                        Click any waiter card to expand and audit every individual transaction, payment channel, and table bill.
                                    </p>
                                </div>
                                <div className="flex items-center rounded-md bg-[#F4F3E8] px-3 py-1.5 border border-[#1A110B]/10 text-xs">
                                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-[#606F69] mr-1.5" />
                                    <input
                                        type="text"
                                        placeholder="Filter staff or table..."
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                        className="bg-transparent text-xs font-medium text-[#1A110B] focus:outline-none w-36"
                                    />
                                    {auditSearch && (
                                        <button onClick={() => setAuditSearch("")} className="text-[#606F69]">
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Waiter Cards Accordion List */}
                            {waiterAuditGroups.length === 0 ? (
                                <div className="rounded-lg bg-white p-12 border border-[#1A110B]/10 text-center space-y-2">
                                    <CheckBadgeIcon className="h-10 w-10 text-slate-400 mx-auto" />
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
                                                    className="rounded-lg bg-white border border-[#1A110B]/10 shadow-xs overflow-hidden transition"
                                                >
                                                    {/* Accordion Card Header */}
                                                    <div
                                                        onClick={() => toggleWaiterAccordion(waiter.waiterId)}
                                                        className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F4F3E8]/40 select-none transition"
                                                    >
                                                        {/* Left: Waiter Name & Info */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-9 w-9 rounded-full bg-[#1A110B] text-white flex items-center justify-center font-black text-xs shrink-0">
                                                                {waiter.waiterName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-sm text-[#1A110B] truncate">
                                                                        {waiter.waiterName}
                                                                    </span>
                                                                    <span className="rounded-md bg-[#1A110B]/5 px-2 py-0.5 text-[10px] font-bold text-[#606F69] uppercase">
                                                                        {waiter.waiterRole}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-[#606F69]">
                                                                    {waiter.orders.length} orders served
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Total Handled + Payment Pills + Chevron */}
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className="text-right hidden sm:block">
                                                                <div className="text-sm font-black font-mono text-[#1A110B] tabular-nums">
                                                                    {formatGHS(waiter.totalAmount)}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono">
                                                                    {waiter.cashAmount > 0 && <span className="text-emerald-700">Cash {formatGHS(waiter.cashAmount)}</span>}
                                                                    {waiter.momoAmount > 0 && <span className="text-sky-700">MoMo {formatGHS(waiter.momoAmount)}</span>}
                                                                    {waiter.cardAmount > 0 && <span className="text-amber-700">Card {formatGHS(waiter.cardAmount)}</span>}
                                                                </div>
                                                            </div>

                                                            <div className="sm:hidden font-black text-xs font-mono">
                                                                {formatGHS(waiter.totalAmount)}
                                                            </div>

                                                            <div className="rounded-full bg-[#1A110B]/5 p-1.5 text-[#1A110B]">
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
                                                        <div className="border-t border-[#1A110B]/10 bg-[#F4F3E8]/30 p-3 sm:p-4 space-y-2.5 animate-in fade-in duration-150">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-[#606F69] block">
                                                                Individual Order Tickets Served by {waiter.waiterName}
                                                            </span>

                                                            <div className="space-y-2">
                                                                {waiter.orders.map(ord => (
                                                                    <div
                                                                        key={ord.id}
                                                                        className="rounded-md bg-white p-3 border border-[#1A110B]/10 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                                    >
                                                                        <div className="space-y-1.5 min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                                                                <span className="rounded-md bg-[#1A110B] text-white px-2 py-0.5 text-[10px] font-black">
                                                                                    {ord.tableLabel}
                                                                                </span>
                                                                                <span className="font-mono text-[10px] text-[#606F69]">
                                                                                    #{ord.id.slice(0, 8)}
                                                                                </span>
                                                                                <span className="text-[10px] text-[#606F69]">
                                                                                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                                </span>
                                                                                
                                                                                {/* Payment Method Badge */}
                                                                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                                                                    ord.paymentMethod === "cash"
                                                                                        ? "bg-emerald-100 text-emerald-800"
                                                                                        : ord.paymentMethod === "mobile_money"
                                                                                        ? "bg-sky-100 text-sky-800"
                                                                                        : ord.paymentMethod === "card"
                                                                                        ? "bg-amber-100 text-amber-800"
                                                                                        : "bg-slate-100 text-slate-700"
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
                                                                                        className="rounded-md bg-[#F4F3E8] px-2 py-1 text-[11px] font-bold text-[#1A110B] border border-[#1A110B]/10"
                                                                                    >
                                                                                        <span className="font-mono font-black">×{it.quantity}</span> {it.name}
                                                                                        {it.lineTotal > 0 && (
                                                                                            <span className="text-[10px] font-mono font-medium text-[#606F69] ml-1">
                                                                                                · {formatGHS(it.lineTotal)}
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        {/* Order Total */}
                                                                        <div className="text-right shrink-0">
                                                                            <span className="text-sm font-black font-mono text-[#1A110B]">
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
                    <div className="rounded-xl bg-white p-5 sm:p-6 border border-[#1A110B]/15 shadow-md space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1A110B]/10 pb-3">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#606F69]">
                                    Station Sign-Off
                                </span>
                                <h3 className="text-base font-black text-[#1A110B]">
                                    Physical Till Count & Handover Sign-Off
                                </h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Cash Count */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-[#1A110B] block">
                                    Counted Physical Cash in Drawer (GH₵)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#606F69]">GH₵</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={closingCashCount}
                                        onChange={e => setClosingCashCount(e.target.value)}
                                        className="w-full rounded-md border border-[#1A110B]/20 bg-[#F4F3E8]/50 py-2 pl-12 pr-3 text-sm font-black text-[#1A110B] focus:ring-1 focus:ring-[#1A110B]"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                    <span className="text-[#606F69]">Expected in Till:</span>
                                    <span className="font-mono font-bold text-[#1A110B]">
                                        {formatGHS(auditSummaryTotals.expectedCashInTill)}
                                    </span>
                                </div>
                                {closingCashCount && (
                                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                                        <span className="text-[#606F69]">Till Variance:</span>
                                        <span className={`font-mono font-black ${
                                            auditSummaryTotals.cashVariance === 0
                                                ? "text-emerald-700"
                                                : auditSummaryTotals.cashVariance < 0
                                                ? "text-rose-700"
                                                : "text-amber-700"
                                        }`}>
                                            {auditSummaryTotals.cashVariance === 0
                                                ? "✓ Balanced"
                                                : auditSummaryTotals.cashVariance > 0
                                                ? `+${formatGHS(auditSummaryTotals.cashVariance)} Over`
                                                : `${formatGHS(auditSummaryTotals.cashVariance)} Short`}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Handover Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-[#1A110B] block">
                                    Handover Notes for Next Shift / Supervisor (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. 2 bottles in ice bath, cash handed over to Shift Supervisor..."
                                    value={handoverNotes}
                                    onChange={e => setHandoverNotes(e.target.value)}
                                    className="w-full rounded-md border border-[#1A110B]/20 bg-[#F4F3E8]/50 p-2 text-xs font-medium text-[#1A110B] focus:ring-1 focus:ring-[#1A110B]"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-[#1A110B]/10">
                            <button
                                type="button"
                                onClick={() => setActiveTab("QUEUE")}
                                className="flex-1 rounded-lg bg-[#F4F3E8] hover:bg-[#1A110B]/10 py-3 text-xs font-bold text-[#1A110B] transition cursor-pointer"
                            >
                                Back to Drink Queue
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCloseShift}
                                className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-700 py-3 text-xs font-black text-white shadow-md transition cursor-pointer"
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
