import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowDownIcon,
    ArrowPathIcon,
    ArrowTrendingUpIcon,
    ArrowUpIcon,
    ChartBarIcon,
    CheckIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    FireIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    SparklesIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbInventoryItem } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../hooks/useVenue";
import clsx from "clsx";
import { ConfirmModal } from "../../components/ConfirmModal";

type InventoryRow = DbInventoryItem & {
    sellingPrice: number;
};

export type TopSellerItem = {
    name: string;
    category: string;
    productId: string | null;
    inventoryId?: string;
    sellingPrice: number;
    unitCost: number;
    quantitySold: number;
    totalRevenue: number;
    totalProfit: number;
    profitMarginPct: number;
    stockQty: number | null;
    reorderThreshold: number;
    isActive: boolean;
    orderCount: number;
    revenueSharePct: number;
    rank: number;
};

type SortField = "revenue" | "quantity" | "price" | "margin" | "profit" | "stock" | "name";
type SortDirection = "asc" | "desc";
type TimeWindow = "today" | "7d" | "30d" | "all";
type PerformanceFilter = "all" | "high_margin" | "low_stock" | "top10";

export function MenuManagerScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [searchParams, setSearchParams] = useSearchParams();

    // Tab state: "inventory" | "top-sellers"
    const activeTab = searchParams.get("tab") === "top-sellers" || searchParams.get("view") === "top-sellers"
        ? "top-sellers"
        : "inventory";

    const setTab = (tab: "inventory" | "top-sellers") => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tab === "top-sellers") {
                next.set("tab", "top-sellers");
            } else {
                next.delete("tab");
                next.delete("view");
            }
            return next;
        });
    };

    // Shared inventory state
    const [items, setItems] = useState<InventoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [editing, setEditing] = useState<InventoryRow | null>(null);
    const [creating, setCreating] = useState(false);
    const [pendingToggleItem, setPendingToggleItem] = useState<InventoryRow | null>(null);

    // Top sellers specific state
    const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
    const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>("all");
    const [sortField, setSortField] = useState<SortField>("revenue");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [topSellersLoading, setTopSellersLoading] = useState(false);
    const [rawOrderItems, setRawOrderItems] = useState<Array<{
        product_name: string;
        quantity: number;
        line_total: number;
        unit_price?: number;
        created_at?: string;
    }>>([]);

    const fetchData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        try {
            const [invResult, prodResult] = await Promise.all([
                db.inventoryByVenue(venue.id),
                db.products(venue.id),
            ]);
            if (invResult.error) throw invResult.error;
            const priceByProduct = new Map((prodResult.data ?? []).map((p) => [p.id, p.price]));
            setItems(
                (invResult.data ?? []).map((i) => ({
                    ...i,
                    sellingPrice: i.product_id ? (priceByProduct.get(i.product_id) ?? 0) : 0,
                })),
            );
        } catch {
            toast.error("Could not load inventory.");
        } finally {
            setLoading(false);
        }
    }, [venue.id]);

    // Fetch order items based on selected time window
    const fetchOrderData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setTopSellersLoading(true);
        try {
            const now = new Date();
            let sinceIso: string | null = null;

            if (timeWindow === "today") {
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                sinceIso = todayStart.toISOString();
            } else if (timeWindow === "7d") {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                sinceIso = sevenDaysAgo.toISOString();
            } else if (timeWindow === "30d") {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                sinceIso = thirtyDaysAgo.toISOString();
            }

            // Query order_submissions joined or order_items
            let query = supabase
                .from("order_items")
                .select("product_name, quantity, line_total, unit_price, created_at, bill_id")
                .limit(2500);

            if (sinceIso) {
                query = query.gte("created_at", sinceIso);
            }

            const { data, error } = await query;
            if (error) {
                // Fallback to orderSubmissionsSince
                const subRes = await db.orderSubmissionsSince(venue.id, sinceIso || new Date(0).toISOString());
                if (subRes.data) {
                    const extracted = subRes.data.flatMap((s) => s.order_items ?? []);
                    setRawOrderItems(extracted);
                }
            } else if (data) {
                setRawOrderItems(data);
            }
        } catch {
            toast.error("Could not refresh sales data.");
        } finally {
            setTopSellersLoading(false);
        }
    }, [venue.id, timeWindow]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (venue.id) {
            void fetchOrderData();
        }
    }, [fetchOrderData, venue.id, timeWindow]);

    const categories = useMemo(
        () => ["All", ...new Set(items.map((i) => i.category).filter(Boolean))],
        [items],
    );

    // Compute Top Sellers analytics list
    const topSellers = useMemo(() => {
        const itemMap = new Map<string, {
            quantitySold: number;
            totalRevenue: number;
            orderCount: number;
        }>();

        for (const oi of rawOrderItems) {
            const name = oi.product_name;
            const cur = itemMap.get(name) ?? { quantitySold: 0, totalRevenue: 0, orderCount: 0 };
            cur.quantitySold += Number(oi.quantity || 1);
            cur.totalRevenue += Number(oi.line_total || ((oi.unit_price ?? 0) * (oi.quantity || 1)));
            cur.orderCount += 1;
            itemMap.set(name, cur);
        }

        // Also incorporate all inventory items (even if 0 sales yet) to provide full menu coverage
        const invMapByName = new Map<string, InventoryRow>();
        for (const item of items) {
            invMapByName.set(item.name.toLowerCase().trim(), item);
        }

        // Total menu revenue across all sold items for share %
        let grandTotalRevenue = 0;
        for (const v of itemMap.values()) {
            grandTotalRevenue += v.totalRevenue;
        }

        const allProductNames = new Set([
            ...itemMap.keys(),
            ...items.map((i) => i.name),
        ]);

        const computed: TopSellerItem[] = [];

        for (const name of allProductNames) {
            const sales = itemMap.get(name) ?? { quantitySold: 0, totalRevenue: 0, orderCount: 0 };
            const invMatch = invMapByName.get(name.toLowerCase().trim());

            const sellingPrice = invMatch?.sellingPrice && invMatch.sellingPrice > 0
                ? invMatch.sellingPrice
                : sales.quantitySold > 0
                    ? sales.totalRevenue / sales.quantitySold
                    : 0;

            const unitCost = Number(invMatch?.unit_cost ?? 0);
            const totalCost = unitCost * sales.quantitySold;
            const totalProfit = sales.totalRevenue - totalCost;
            const profitMarginPct = sales.totalRevenue > 0
                ? (totalProfit / sales.totalRevenue) * 100
                : (sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0);

            const revenueSharePct = grandTotalRevenue > 0
                ? (sales.totalRevenue / grandTotalRevenue) * 100
                : 0;

            computed.push({
                name,
                category: invMatch?.category || "General",
                productId: invMatch?.product_id || null,
                inventoryId: invMatch?.id,
                sellingPrice,
                unitCost,
                quantitySold: sales.quantitySold,
                totalRevenue: sales.totalRevenue,
                totalProfit,
                profitMarginPct,
                stockQty: invMatch ? Number(invMatch.stock_qty) : null,
                reorderThreshold: invMatch ? Number(invMatch.reorder_threshold) : 5,
                isActive: invMatch ? invMatch.is_active : true,
                orderCount: sales.orderCount,
                revenueSharePct,
                rank: 0, // Assigned after sorting
            });
        }

        // Default ranking sorted by revenue descending
        const ranked = computed
            .sort((a, b) => b.totalRevenue - a.totalRevenue || b.quantitySold - a.quantitySold)
            .map((item, idx) => ({ ...item, rank: idx + 1 }));

        return ranked;
    }, [rawOrderItems, items]);

    // Filter and sort top sellers list
    const filteredTopSellers = useMemo(() => {
        let result = topSellers.filter((item) => {
            // Category filter
            if (activeCategory !== "All" && item.category !== activeCategory) return false;
            // Search filter
            if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.category.toLowerCase().includes(search.toLowerCase())) {
                return false;
            }
            // Performance filter
            if (performanceFilter === "high_margin" && item.profitMarginPct < 50) return false;
            if (performanceFilter === "low_stock") {
                if (item.stockQty === null || item.stockQty > item.reorderThreshold) return false;
            }
            return true;
        });

        // Sorting
        result.sort((a, b) => {
            let comparison = 0;
            if (sortField === "revenue") comparison = a.totalRevenue - b.totalRevenue;
            else if (sortField === "quantity") comparison = a.quantitySold - b.quantitySold;
            else if (sortField === "price") comparison = a.sellingPrice - b.sellingPrice;
            else if (sortField === "margin") comparison = a.profitMarginPct - b.profitMarginPct;
            else if (sortField === "profit") comparison = a.totalProfit - b.totalProfit;
            else if (sortField === "stock") comparison = (a.stockQty ?? 0) - (b.stockQty ?? 0);
            else if (sortField === "name") comparison = a.name.localeCompare(b.name);

            return sortDirection === "asc" ? comparison : -comparison;
        });

        if (performanceFilter === "top10") {
            result = result.slice(0, 10);
        }

        return result;
    }, [topSellers, activeCategory, search, performanceFilter, sortField, sortDirection]);

    // KPI Summary Metrics for Top Sellers
    const topSellersKPIs = useMemo(() => {
        const topPerformer = topSellers.find((i) => i.quantitySold > 0) || topSellers[0];
        const totalVolume = topSellers.reduce((s, i) => s + i.quantitySold, 0);
        const totalGrossRevenue = topSellers.reduce((s, i) => s + i.totalRevenue, 0);
        const totalGrossProfit = topSellers.reduce((s, i) => s + i.totalProfit, 0);
        const avgMargin = totalGrossRevenue > 0
            ? (totalGrossProfit / totalGrossRevenue) * 100
            : 0;

        return {
            topPerformer,
            totalVolume,
            totalGrossRevenue,
            totalGrossProfit,
            avgMargin,
        };
    }, [topSellers]);

    // Handlers for sorting toggle
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection(field === "name" ? "asc" : "desc");
        }
    };

    // Filtered inventory items for inventory tab
    const filteredInventory = items.filter((item) => {
        if (activeCategory !== "All" && item.category !== activeCategory) return false;
        if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const toggleActive = async (item: InventoryRow | { id: string; name: string; is_active: boolean }) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const next = !item.is_active;
        const { error } = await supabaseUpdateInventory(venue.id, item.id, { is_active: next });
        if (error) {
            toast.error("Could not update item.");
            return;
        }
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: next } : i)));
        toast.success(next ? `${item.name} is back on the menu.` : `${item.name} hidden from the menu.`);
    };

    const requestToggleOff = (item: InventoryRow) => {
        if (item.is_active) {
            setPendingToggleItem(item);
        } else {
            void toggleActive(item);
        }
    };

    const restockItem = async (itemId: string, itemName: string, currentStock: number) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const newStock = Number(currentStock) + 10;
        const { error } = await supabaseUpdateInventory(venue.id, itemId, { stock_qty: newStock });
        if (error) {
            toast.error("Could not restock.");
            return;
        }
        setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, stock_qty: newStock } : i)));
        toast.success(`Restocked ${itemName} +10.`);
    };

    const saveItem = async (updated: InventoryRow) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const { error } = await supabaseUpdateInventory(venue.id, updated.id, {
            name: updated.name,
            category: updated.category,
            stock_qty: updated.stock_qty,
            reorder_threshold: updated.reorder_threshold,
            unit_cost: updated.unit_cost,
            supplier: updated.supplier || null,
        });
        if (error) {
            toast.error("Could not save item.");
            return;
        }
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setEditing(null);
        toast.success("Item updated.");
    };

    const deleteItem = async (id: string) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const { error } = await supabase
            .from("inventory_items")
            .delete()
            .eq("id", id)
            .eq("venue_id", venue.id);
        if (error) {
            toast.error("Could not delete item.");
            return;
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
        setEditing(null);
        toast.success("Item deleted.");
    };

    const addItem = async (newItem: InventoryRow) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const { data, error } = await supabase
            .from("inventory_items")
            .insert({
                venue_id: venue.id,
                name: newItem.name,
                category: newItem.category,
                stock_qty: newItem.stock_qty,
                unit: newItem.unit || "pieces",
                reorder_threshold: newItem.reorder_threshold,
                unit_cost: newItem.unit_cost,
                supplier: newItem.supplier || null,
                is_active: true,
            })
            .select()
            .single<DbInventoryItem>();
        if (error || !data) {
            toast.error("Could not add item.");
            return;
        }
        setItems((prev) => [{ ...data, sellingPrice: 0 }, ...prev]);
        setCreating(false);
        toast.success("Item added.");
    };

    // Inventory metrics
    const totalItems = items.filter((i) => i.is_active).length;
    const lowStock = items.filter((i) => i.is_active && Number(i.stock_qty) > 0 && Number(i.stock_qty) <= Number(i.reorder_threshold)).length;
    const outOfStock = items.filter((i) => i.is_active && Number(i.stock_qty) === 0).length;
    const totalInventoryValue = items.reduce((s, i) => s + Number(i.unit_cost) * Number(i.stock_qty), 0);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ═══════════════════════════════════════════════════════════
               HEADER & TOP-LEVEL VIEW TABS
               ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-licorice/10 pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-licorice">Menu & Inventory Manager</h1>
                    <p className="text-xs text-feldgrau mt-0.5">
                        Track live stock, analyze top-performing dishes & drinks, and optimize gross margins.
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="inline-flex rounded-full bg-isabelline p-1.5 ring-1 ring-licorice/8 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setTab("top-sellers")}
                        className={clsx(
                            "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-150",
                            activeTab === "top-sellers"
                                ? "bg-licorice text-isabelline shadow-md"
                                : "text-feldgrau hover:text-licorice"
                        )}
                    >
                        <FireIcon className={clsx("h-4 w-4", activeTab === "top-sellers" ? "text-khaki" : "text-feldgrau")} strokeWidth={2.25} />
                        <span>Top Sellers & Analytics</span>
                        <span className={clsx(
                            "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                            activeTab === "top-sellers" ? "bg-khaki/30 text-khaki" : "bg-licorice/10 text-feldgrau"
                        )}>
                            Live
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("inventory")}
                        className={clsx(
                            "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-150",
                            activeTab === "inventory"
                                ? "bg-licorice text-isabelline shadow-md"
                                : "text-feldgrau hover:text-licorice"
                        )}
                    >
                        <CubeIcon className="h-4 w-4" strokeWidth={2} />
                        <span>Inventory & Stock</span>
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               TAB 1: TOP SELLERS EXPANDED VIEW
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "top-sellers" && (
                <div className="space-y-6">
                    {/* Hero KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {/* 1. Best Selling Performer */}
                        <div className="col-span-2 sm:col-span-1 rounded-[1.5rem] bg-gradient-to-br from-licorice to-licorice/90 text-isabelline p-5 shadow-sm ring-1 ring-licorice/20 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute right-3 top-3 opacity-15">
                                <SparklesIcon className="h-16 w-16 text-khaki" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-khaki text-[11px] font-black text-licorice">1</span>
                                    <p className="text-xs font-bold uppercase tracking-wider text-khaki">Top Performer</p>
                                </div>
                                <h3 className="mt-2 text-lg font-bold truncate text-isabelline">
                                    {topSellersKPIs.topPerformer?.name || "No sales yet"}
                                </h3>
                                <p className="text-xs text-isabelline/70 mt-0.5">
                                    {topSellersKPIs.topPerformer?.category || "General"} · {topSellersKPIs.topPerformer?.quantitySold ?? 0} units sold
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-isabelline/10 flex items-baseline justify-between">
                                <span className="text-xs text-isabelline/60">Revenue</span>
                                <span className="text-lg font-bold tabular-nums text-khaki">
                                    {formatGHS(topSellersKPIs.topPerformer?.totalRevenue ?? 0)}
                                </span>
                            </div>
                        </div>

                        {/* 2. Total Volume */}
                        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <CubeIcon className="h-4 w-4 text-feldgrau" />
                                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Volume Sold</p>
                                </div>
                                <p className="mt-3 text-3xl font-bold tabular-nums text-licorice">
                                    {topSellersKPIs.totalVolume} <span className="text-sm font-normal text-feldgrau">units</span>
                                </p>
                            </div>
                            <p className="mt-3 text-xs text-feldgrau">
                                Across {topSellers.filter((i) => i.quantitySold > 0).length} active menu items
                            </p>
                        </div>

                        {/* 3. Total Menu Sales */}
                        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-600" />
                                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Total Menu Sales</p>
                                </div>
                                <p className="mt-3 text-3xl font-bold tabular-nums text-licorice">
                                    {formatGHS(topSellersKPIs.totalGrossRevenue)}
                                </p>
                            </div>
                            <p className="mt-3 text-xs text-emerald-700 font-semibold">
                                Gross Profit: {formatGHS(topSellersKPIs.totalGrossProfit)}
                            </p>
                        </div>

                        {/* 4. Average Margin */}
                        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-isabelline flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <ChartBarIcon className="h-4 w-4 text-khaki" />
                                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Avg. Margin</p>
                                </div>
                                <p className="mt-3 text-3xl font-bold tabular-nums text-licorice">
                                    {topSellersKPIs.avgMargin.toFixed(1)}%
                                </p>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                                <span className={clsx(
                                    "inline-flex h-2 w-2 rounded-full",
                                    topSellersKPIs.avgMargin >= 50 ? "bg-emerald-500" : "bg-amber-500"
                                )} />
                                <p className="text-xs text-feldgrau">
                                    {topSellersKPIs.avgMargin >= 50 ? "Strong profitability" : "Balanced margin"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filter & Sorting Toolbar */}
                    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Search */}
                            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                                <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filter top sellers by name or category…"
                                    className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                                />
                                {search && (
                                    <button type="button" onClick={() => setSearch("")} className="text-feldgrau hover:text-licorice">
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Time Window Switcher */}
                            <div className="flex items-center gap-1 rounded-full bg-isabelline p-1 ring-1 ring-licorice/8">
                                {(
                                    [
                                        { id: "today", label: "Today" },
                                        { id: "7d", label: "Last 7D" },
                                        { id: "30d", label: "Last 30D" },
                                        { id: "all", label: "All Time" },
                                    ] as const
                                ).map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTimeWindow(t.id)}
                                        className={clsx(
                                            "rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all",
                                            timeWindow === t.id
                                                ? "bg-licorice text-isabelline shadow-sm"
                                                : "text-feldgrau hover:text-licorice"
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Refresh Button */}
                            <button
                                type="button"
                                onClick={() => void fetchOrderData()}
                                disabled={topSellersLoading}
                                title="Refresh sales data"
                                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-isabelline text-feldgrau hover:text-licorice ring-1 ring-licorice/8 transition-all disabled:opacity-50"
                            >
                                <ArrowPathIcon className={clsx("h-4 w-4", topSellersLoading && "animate-spin")} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Secondary Filters: Categories & Performance Pills */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-isabelline">
                            {/* Category Pills */}
                            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
                                <span className="text-xs font-bold uppercase text-feldgrau mr-1">Category:</span>
                                {categories.map((cat) => {
                                    const isActive = cat === activeCategory;
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setActiveCategory(cat)}
                                            className={clsx(
                                                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold tracking-tight transition-all",
                                                isActive
                                                    ? "bg-licorice text-isabelline shadow-sm"
                                                    : "bg-isabelline text-feldgrau hover:text-licorice ring-1 ring-licorice/5"
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Performance Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold uppercase text-feldgrau mr-1">View:</span>
                                {(
                                    [
                                        { id: "all", label: "All Items" },
                                        { id: "top10", label: "Top 10" },
                                        { id: "high_margin", label: "High Margin (>50%)" },
                                        { id: "low_stock", label: "Low Stock Alert" },
                                    ] as const
                                ).map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setPerformanceFilter(f.id)}
                                        className={clsx(
                                            "rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
                                            performanceFilter === f.id
                                                ? "bg-khaki/20 text-licorice ring-1 ring-khaki"
                                                : "bg-isabelline text-feldgrau hover:text-licorice"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top Sellers Table View */}
                    {topSellersLoading || loading ? (
                        <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                            <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Calculating sales performance…</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-isabelline">
                            <table className="hidden md:table w-full">
                                <thead className="border-b border-isabelline bg-isabelline/50 text-left">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-feldgrau">Rank</th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("name")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Item & Category</span>
                                                {sortField === "name" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("price")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Menu Price</span>
                                                {sortField === "price" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("quantity")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Qty Sold</span>
                                                {sortField === "quantity" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("revenue")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Total Revenue</span>
                                                {sortField === "revenue" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("margin")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Margin & Profit</span>
                                                {sortField === "margin" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 text-xs font-bold uppercase text-feldgrau cursor-pointer hover:text-licorice"
                                            onClick={() => handleSort("stock")}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Stock</span>
                                                {sortField === "stock" && (
                                                    sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-feldgrau text-right">Menu Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-isabelline">
                                    {filteredTopSellers.map((item) => {
                                        const maxSold = topSellers[0]?.quantitySold || 1;
                                        const soldPct = Math.min(100, Math.round((item.quantitySold / maxSold) * 100));
                                        const isLowStock = item.stockQty !== null && item.stockQty > 0 && item.stockQty <= item.reorderThreshold;
                                        const isOutOfStock = item.stockQty === 0;

                                        return (
                                            <tr key={item.name} className={clsx("hover:bg-isabelline/30 transition-colors", !item.isActive && "opacity-50")}>
                                                {/* Rank Badge */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        {item.rank === 1 ? (
                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 font-bold text-xs text-amber-950 shadow-sm ring-2 ring-amber-300">
                                                                1
                                                            </span>
                                                        ) : item.rank === 2 ? (
                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 font-bold text-xs text-slate-800 shadow-sm">
                                                                2
                                                            </span>
                                                        ) : item.rank === 3 ? (
                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 font-bold text-xs text-amber-100 shadow-sm">
                                                                3
                                                            </span>
                                                        ) : (
                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-isabelline font-bold text-xs text-feldgrau">
                                                                {item.rank}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Item Info */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={clsx(
                                                            "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-[13px] shadow-sm",
                                                            item.category === "Spirits" ? "bg-amber-100 text-amber-800" :
                                                            item.category === "Wines" ? "bg-purple-100 text-purple-800" :
                                                            item.category === "Cocktails" ? "bg-rose-100 text-rose-800" :
                                                            item.category === "Mains" ? "bg-emerald-100 text-emerald-800" :
                                                            "bg-isabelline text-licorice ring-1 ring-licorice/10"
                                                        )}>
                                                            {item.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0 max-w-[200px] lg:max-w-[260px]">
                                                            <p className="truncate text-[13px] font-bold tracking-tight text-licorice">{item.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="rounded-full bg-isabelline px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider text-feldgrau">
                                                                    {item.category}
                                                                </span>
                                                                {item.orderCount > 0 && (
                                                                    <span className="text-[11px] text-feldgrau">
                                                                        · {item.orderCount} orders
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Price */}
                                                <td className="px-4 py-3 font-mono text-[13px] font-bold tabular-nums text-licorice">
                                                    {item.sellingPrice > 0 ? formatGHS(item.sellingPrice) : <span className="text-feldgrau/40">—</span>}
                                                </td>

                                                {/* Qty Sold & Share */}
                                                <td className="px-4 py-3">
                                                    <div className="w-28">
                                                        <div className="flex items-baseline justify-between">
                                                            <span className="font-mono text-[13px] font-bold tabular-nums text-licorice">
                                                                {item.quantitySold}
                                                            </span>
                                                            <span className="text-[10px] text-feldgrau">
                                                                {item.revenueSharePct > 0 ? `${item.revenueSharePct.toFixed(0)}% rev` : ""}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-isabelline">
                                                            <div
                                                                className={clsx("h-full rounded-full transition-all", item.rank <= 3 ? "bg-khaki" : "bg-licorice/40")}
                                                                style={{ width: `${item.quantitySold > 0 ? Math.max(8, soldPct) : 0}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Revenue */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-[13px] font-bold tabular-nums text-licorice">
                                                            {formatGHS(item.totalRevenue)}
                                                        </span>
                                                        <span className="text-[10px] text-feldgrau">
                                                            {item.revenueSharePct > 0 ? `${item.revenueSharePct.toFixed(1)}% of total` : "0%"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Margin & Profit */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={clsx(
                                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                                                item.profitMarginPct >= 50 ? "bg-emerald-100 text-emerald-700" :
                                                                item.profitMarginPct >= 30 ? "bg-khaki/20 text-khaki" :
                                                                "bg-dark-red/10 text-dark-red"
                                                            )}>
                                                                {item.profitMarginPct.toFixed(0)}%
                                                            </span>
                                                            {item.totalProfit > 0 && (
                                                                <span className="text-[11px] font-mono text-emerald-700 font-semibold tabular-nums">
                                                                    +{formatGHS(item.totalProfit)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.unitCost > 0 && (
                                                            <span className="text-[10px] text-feldgrau">
                                                                Cost: {formatGHS(item.unitCost)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Stock Status & Quick Restock */}
                                                <td className="px-4 py-3">
                                                    {item.stockQty !== null ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex flex-col">
                                                                <span className={clsx(
                                                                    "font-mono text-[12px] font-bold tabular-nums",
                                                                    isOutOfStock ? "text-dark-red" : isLowStock ? "text-amber-600" : "text-licorice"
                                                                )}>
                                                                    {item.stockQty} in stock
                                                                </span>
                                                                {isLowStock && (
                                                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                                                        <ExclamationTriangleIcon className="h-3 w-3" /> Low stock
                                                                    </span>
                                                                )}
                                                                {isOutOfStock && (
                                                                    <span className="text-[10px] font-bold text-dark-red">Out of stock</span>
                                                                )}
                                                            </div>
                                                            {item.inventoryId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void restockItem(item.inventoryId!, item.name, item.stockQty!)}
                                                                    title="Restock +10"
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-isabelline text-feldgrau hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                                                >
                                                                    <PlusIcon className="h-3 w-3" strokeWidth={2.5} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-feldgrau/50">Not tracked</span>
                                                    )}
                                                </td>

                                                {/* Status & Actions */}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {item.inventoryId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const inv = items.find((i) => i.id === item.inventoryId);
                                                                    if (inv) requestToggleOff(inv);
                                                                }}
                                                                className={clsx(
                                                                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                                                    item.isActive ? "bg-khaki" : "bg-feldgrau/20"
                                                                )}
                                                                title={item.isActive ? "Hide from menu" : "Show on menu"}
                                                            >
                                                                <span
                                                                    className={clsx(
                                                                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                                                                        item.isActive ? "translate-x-5" : "translate-x-1"
                                                                    )}
                                                                />
                                                            </button>
                                                        )}
                                                        {item.inventoryId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const inv = items.find((i) => i.id === item.inventoryId);
                                                                    if (inv) setEditing(inv);
                                                                }}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau hover:bg-khaki/15 hover:text-licorice"
                                                            >
                                                                <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mobile Card List for Top Sellers */}
                            <div className="md:hidden divide-y divide-isabelline">
                                {filteredTopSellers.map((item) => (
                                    <div key={item.name} className={clsx("p-4 space-y-3", !item.isActive && "opacity-50")}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className={clsx(
                                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                                    item.rank === 1 ? "bg-amber-400 text-amber-950 font-black ring-2 ring-amber-300" :
                                                    item.rank === 2 ? "bg-slate-300 text-slate-800" :
                                                    item.rank === 3 ? "bg-amber-700 text-amber-100" : "bg-isabelline text-feldgrau"
                                                )}>
                                                    {item.rank}
                                                </span>
                                                <div>
                                                    <h4 className="text-[13px] font-bold text-licorice tracking-tight">{item.name}</h4>
                                                    <span className="rounded-full bg-isabelline px-2 py-0.2 text-[10px] font-bold uppercase text-feldgrau">
                                                        {item.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono text-sm font-bold text-licorice">{formatGHS(item.totalRevenue)}</p>
                                                <p className="text-xs text-feldgrau">{item.quantitySold} sold</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 bg-isabelline/50 rounded-xl p-2.5 text-center">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-feldgrau">Price</p>
                                                <p className="font-mono text-xs font-bold text-licorice">{item.sellingPrice > 0 ? formatGHS(item.sellingPrice) : "—"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-feldgrau">Margin</p>
                                                <p className={clsx("text-xs font-bold", item.profitMarginPct >= 50 ? "text-emerald-700" : "text-khaki")}>
                                                    {item.profitMarginPct.toFixed(0)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-feldgrau">Stock</p>
                                                <p className={clsx("font-mono text-xs font-bold", item.stockQty === 0 ? "text-dark-red" : "text-licorice")}>
                                                    {item.stockQty ?? "—"}
                                                </p>
                                            </div>
                                        </div>

                                        {item.inventoryId && (
                                            <div className="flex items-center justify-between pt-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-feldgrau">Active:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const inv = items.find((i) => i.id === item.inventoryId);
                                                            if (inv) requestToggleOff(inv);
                                                        }}
                                                        className={clsx(
                                                            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                                            item.isActive ? "bg-khaki" : "bg-feldgrau/20"
                                                        )}
                                                    >
                                                        <span
                                                            className={clsx(
                                                                "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                                                                item.isActive ? "translate-x-5" : "translate-x-1"
                                                            )}
                                                        />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.stockQty !== null && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void restockItem(item.inventoryId!, item.name, item.stockQty!)}
                                                            className="rounded-full bg-isabelline px-3 py-1 text-xs font-bold text-licorice hover:bg-emerald-100"
                                                        >
                                                            +10 Stock
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const inv = items.find((i) => i.id === item.inventoryId);
                                                            if (inv) setEditing(inv);
                                                        }}
                                                        className="rounded-full bg-isabelline p-1.5 text-feldgrau"
                                                    >
                                                        <PencilSquareIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {filteredTopSellers.length === 0 && (
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <FunnelIcon className="h-6 w-6 text-feldgrau/40" />
                                    <p className="mt-3 text-[13px] font-bold tracking-tight text-licorice">No items match your top seller filters</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setActiveCategory("All");
                                            setPerformanceFilter("all");
                                        }}
                                        className="mt-2 text-xs font-bold text-khaki hover:underline"
                                    >
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
               TAB 2: INVENTORY & STOCK VIEW (Classic Inventory Management)
               ═══════════════════════════════════════════════════════════ */}
            {activeTab === "inventory" && (
                <div className="space-y-6">
                    {/* Inventory Value KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:flex md:flex-row md:overflow-x-auto md:no-scrollbar md:gap-4">
                        <div className="col-span-2 md:shrink-0 md:min-w-[320px] rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Inv. Value</p>
                            <p className="text-4xl font-bold tabular-nums text-licorice">{formatGHS(totalInventoryValue)}</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Total Items</p>
                            <p className="text-4xl font-bold tabular-nums text-licorice">{totalItems}</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Available</p>
                            <p className="text-4xl font-bold tabular-nums text-khaki">{items.filter((i) => i.is_active).length}</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)] flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-isabelline/60">Low Stock</p>
                            <p className="text-4xl font-bold tabular-nums text-khaki">{lowStock}</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Out of Stock</p>
                            <p className="text-4xl font-bold tabular-nums text-dark-red">{outOfStock}</p>
                        </div>
                    </div>

                    {/* Search & Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-isabelline">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search inventory items…"
                                className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                            />
                        </div>
                        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                            {categories.map((cat) => {
                                const isActive = cat === activeCategory;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setActiveCategory(cat)}
                                        className={clsx(
                                            "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all",
                                            isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95"
                        >
                            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Add Item
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                            <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Loading inventory…</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-isabelline">
                            <table className="hidden md:table w-full">
                                <thead className="border-b border-isabelline bg-isabelline/50">
                                    <tr className="text-left">
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Item</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Cat.</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Cost</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Sell</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Margin</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Stock</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau">Status</th>
                                        <th className="px-4 py-2.5 text-xs font-bold uppercase text-feldgrau text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-isabelline">
                                    {filteredInventory.map((item) => {
                                        const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - Number(item.unit_cost)) / item.sellingPrice) * 100 : 0;
                                        const stock = Number(item.stock_qty);
                                        const isLow = stock > 0 && stock <= Number(item.reorder_threshold);
                                        return (
                                            <tr key={item.id} className={clsx("hover:bg-isabelline/30 transition-colors", !item.is_active && "opacity-50")}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={clsx(
                                                            "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-[12px]",
                                                            item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                                            item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                                                        )}>
                                                            {item.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                                            <p className="truncate text-xs tracking-tight text-feldgrau">{item.supplier || "No supplier"} · {item.unit}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="rounded-full bg-isabelline px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-feldgrau">{item.category}</span>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-feldgrau">{formatGHS(Number(item.unit_cost))}</td>
                                                <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{item.sellingPrice > 0 ? formatGHS(item.sellingPrice) : <span className="text-feldgrau/50">—</span>}</td>
                                                <td className="px-4 py-2.5">
                                                    {item.sellingPrice > 0 ? (
                                                        <span className={clsx(
                                                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                                                            marginPct > 50 ? "bg-emerald-100 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red"
                                                        )}>
                                                            {marginPct.toFixed(0)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-feldgrau/50">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={clsx("font-mono text-[12px] font-bold tabular-nums", stock === 0 ? "text-dark-red" : isLow ? "text-amber-600" : "text-licorice")}>{stock}</span>
                                                        {isLow && <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" strokeWidth={2} />}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => requestToggleOff(item)}
                                                        className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.is_active ? "bg-khaki" : "bg-feldgrau/20")}
                                                    >
                                                        <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.is_active ? "translate-x-5" : "translate-x-1")} />
                                                    </button>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => void restockItem(item.id, item.name, Number(item.stock_qty))}
                                                            title="Restock +10"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau transition-colors hover:bg-emerald-100 hover:text-emerald-600"
                                                        >
                                                            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditing(item)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau transition-colors hover:bg-khaki/15 hover:text-licorice"
                                                        >
                                                            <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="md:hidden divide-y divide-isabelline">
                                {filteredInventory.map((item) => {
                                    const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - Number(item.unit_cost)) / item.sellingPrice) * 100 : 0;
                                    const stock = Number(item.stock_qty);
                                    const isLow = stock > 0 && stock <= Number(item.reorder_threshold);
                                    return (
                                        <div key={item.id} className={clsx("flex items-center gap-3 px-4 py-3", !item.is_active && "opacity-50")}>
                                            <div className={clsx(
                                                "h-12 w-12 shrink-0 rounded-lg flex items-center justify-center font-bold text-[14px]",
                                                item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                                item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                                            )}>
                                                {item.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                                <div className="mt-0.5 flex items-center gap-2 text-xs flex-wrap">
                                                    <span className="font-mono font-bold text-licorice">{item.sellingPrice > 0 ? formatGHS(item.sellingPrice) : "—"}</span>
                                                    <span className="text-feldgrau">·</span>
                                                    <span className={clsx("font-bold", stock === 0 ? "text-dark-red" : isLow ? "text-amber-600" : "text-feldgrau")}>Stock: {stock}</span>
                                                    {item.sellingPrice > 0 && (
                                                        <>
                                                            <span className="text-feldgrau">·</span>
                                                            <span className={clsx("font-bold", marginPct > 50 ? "text-emerald-600" : marginPct > 30 ? "text-khaki" : "text-dark-red")}>{marginPct.toFixed(0)}% margin</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => requestToggleOff(item)}
                                                className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.is_active ? "bg-khaki" : "bg-feldgrau/20")}
                                            >
                                                <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.is_active ? "translate-x-5" : "translate-x-1")} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditing(item)}
                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-isabelline text-feldgrau"
                                            >
                                                <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredInventory.length === 0 && (
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                                    <p className="mt-3 text-[12px] font-bold tracking-tight text-licorice">No items match your filters</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal for editing / creating an inventory item */}
            {(editing || creating) && (
                <ItemModal
                    item={editing}
                    onSave={editing ? saveItem : addItem}
                    onClose={() => { setEditing(null); setCreating(false); }}
                    onDelete={editing ? () => deleteItem(editing.id) : undefined}
                />
            )}

            {/* Hide item confirm modal */}
            <ConfirmModal
                isOpen={pendingToggleItem !== null}
                title={`Hide "${pendingToggleItem?.name}" from guests?`}
                body="Customers won't be able to order this item until you turn it back on."
                confirmLabel="Hide Item"
                cancelLabel="Keep Visible"
                isDanger={false}
                onConfirm={() => {
                    if (pendingToggleItem) void toggleActive(pendingToggleItem);
                    setPendingToggleItem(null);
                }}
                onClose={() => setPendingToggleItem(null)}
            />
        </div>
    );
}

/* ────────────────────────── Helpers ────────────────────────── */

async function supabaseUpdateInventory(venueId: string, id: string, updates: Partial<DbInventoryItem>) {
    const { error } = await supabase
        .from("inventory_items")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("venue_id", venueId);
    return { error };
}

function ItemModal({ item, onSave, onClose, onDelete }: {
    item: InventoryRow | null;
    onSave: (item: InventoryRow) => void;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [draft, setDraft] = useState<InventoryRow>(item ?? {
        id: `inv-${Date.now()}`,
        venue_id: "",
        product_id: null,
        name: "",
        category: "General",
        stock_qty: 10,
        unit: "pieces",
        reorder_threshold: 5,
        unit_cost: 0,
        supplier: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sellingPrice: 0,
    });
    const marginPct = draft.sellingPrice > 0 ? ((draft.sellingPrice - Number(draft.unit_cost)) / draft.sellingPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[1.5rem] md:rounded-[1.5rem] bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-isabelline bg-white px-5 py-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-feldgrau">{item ? "Edit Item" : "New Item"}</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">{item ? item.name : "Add inventory item"}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice">
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>
                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Item Name</label>
                        <input
                            type="text"
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            placeholder="Cocoa Espresso Liqueur"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Category</label>
                            <input
                                type="text"
                                value={draft.category}
                                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                                placeholder="Spirits"
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Unit</label>
                            <input
                                type="text"
                                value={draft.unit}
                                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                                placeholder="bottle / kg / pieces"
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Unit Cost (GHS)</label>
                            <input
                                type="number"
                                value={Number(draft.unit_cost)}
                                onChange={(e) => setDraft({ ...draft, unit_cost: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Sell Price (menu)</label>
                            <input
                                type="number"
                                value={draft.sellingPrice}
                                disabled
                                className="mt-1 w-full rounded-lg bg-isabelline/50 px-3 py-2 font-mono text-[12px] tabular-nums text-feldgrau ring-1 ring-licorice/8"
                            />
                        </div>
                    </div>
                    {draft.sellingPrice > 0 && (
                        <div className={clsx(
                            "rounded-lg px-3 py-2 text-xs font-bold",
                            marginPct > 50 ? "bg-emerald-50 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red"
                        )}>
                            Margin: {marginPct.toFixed(0)}% · Profit: {formatGHS(draft.sellingPrice - Number(draft.unit_cost))}/unit
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Stock</label>
                            <input
                                type="number"
                                value={Number(draft.stock_qty)}
                                onChange={(e) => setDraft({ ...draft, stock_qty: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Reorder At</label>
                            <input
                                type="number"
                                value={Number(draft.reorder_threshold)}
                                onChange={(e) => setDraft({ ...draft, reorder_threshold: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Supplier</label>
                        <input
                            type="text"
                            value={draft.supplier ?? ""}
                            onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                            placeholder="e.g. Premium Wines GH"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                </div>
                <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-isabelline bg-white px-5 py-3">
                    {onDelete ? (
                        <button
                            type="button"
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-dark-red/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-dark-red transition-colors hover:bg-dark-red/20"
                        >
                            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} /> Delete
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-xs font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => { if (draft.name.trim()) onSave(draft); }}
                            disabled={!draft.name.trim()}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                        >
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Save
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete item confirm */}
            <ConfirmModal
                isOpen={deleteConfirmOpen}
                title={`Delete "${item?.name}"?`}
                body="This item will be permanently removed from your menu and inventory. Orders already placed won't be affected."
                confirmLabel="Delete Item"
                cancelLabel="Keep It"
                isDanger
                onConfirm={() => { setDeleteConfirmOpen(false); onDelete?.(); }}
                onClose={() => setDeleteConfirmOpen(false)}
            />
        </div>
    );
}
