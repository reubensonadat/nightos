import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowPathIcon,
    BanknotesIcon,
    CheckIcon,
    CubeIcon,
    FireIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
    PhotoIcon,
    TagIcon,
    ChartBarIcon,
    FunnelIcon,
    ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbProduct, type DbMenuCategory } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../hooks/useVenue";
import clsx from "clsx";
import { ConfirmModal } from "../../components/ConfirmModal";
import { BulkMenuUploadModal } from "../../components/BulkMenuUploadModal";
import { uploadToR2 } from "../../lib/r2";
import { cacheGet, cacheSet, TTL } from "../../lib/cache";

interface InventoryProductCardProps {
    prod: DbProduct;
    catName: string;
    marginPct: number | null;
    onEdit: (prod: DbProduct) => void;
    onToggleActive: (prod: DbProduct) => void;
}

const InventoryProductCard = memo(function InventoryProductCard({
    prod,
    catName,
    marginPct,
    onEdit,
    onToggleActive,
}: InventoryProductCardProps) {
    return (
        <article
            onClick={() => onEdit(prod)}
            className={clsx(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-licorice/8 hover:shadow-md hover:ring-licorice/20 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                !prod.is_active && "opacity-75"
            )}
        >
            {/* A. Top: Media & Badges */}
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-white p-2.5 sm:p-3 flex items-center justify-center border-b border-licorice/5">
                {prod.images?.[0] ? (
                    <img
                        src={prod.images[0]}
                        alt={prod.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-licorice/85 to-licorice">
                        <span className="font-serif text-3xl font-bold text-isabelline/80">
                            {prod.name.charAt(0)}
                        </span>
                    </div>
                )}

                {/* Floating Badge: Category (Top-Left) */}
                <div className="absolute left-2.5 top-2.5 z-10">
                    <span className="inline-flex h-5.5 items-center rounded-full bg-licorice/90 px-2.5 text-[10px] font-bold text-isabelline shadow-xs backdrop-blur-xs">
                        {catName}
                    </span>
                </div>

                {/* Floating Badge: Station (Top-Right) */}
                <div className="absolute right-2.5 top-2.5 z-10">
                    <span className="inline-flex h-5.5 items-center rounded-full bg-white/95 px-2 text-[9.5px] font-bold uppercase tracking-wider text-licorice shadow-xs ring-1 ring-licorice/10 backdrop-blur-xs">
                        {prod.station || "kitchen"}
                    </span>
                </div>
            </div>

            {/* Card Body */}
            <div className="flex flex-1 flex-col justify-between p-3.5">
                {/* B. Upper Info Row: Name & Selling Price */}
                <div>
                    <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-bold leading-snug tracking-tight text-licorice group-hover:text-licorice/90 transition-colors line-clamp-1">
                            {prod.name}
                        </h3>
                        <span className="font-mono text-sm font-bold text-licorice shrink-0">
                            {formatGHS(prod.price)}
                        </span>
                    </div>

                    {/* Optional Description */}
                    {prod.description && (
                        <p className="mt-1 text-[11.5px] leading-snug text-feldgrau line-clamp-1">
                            {prod.description}
                        </p>
                    )}
                </div>

                {/* C. Subtle Divider */}
                <div className="my-2.5 border-t border-licorice/6" />

                {/* D. Bottom Info Row: Cost / Margin (Left) & Stock Pill (Right) */}
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-feldgrau">
                        {prod.cost_price ? (
                            <span>
                                Cost: <span className="font-mono font-semibold text-licorice">{formatGHS(prod.cost_price)}</span>
                                {marginPct !== null && (
                                    <span className="ml-1 font-bold text-emerald-700">({marginPct}%)</span>
                                )}
                            </span>
                        ) : (
                            <span className="italic text-feldgrau/40 text-[10.5px]">No cost set</span>
                        )}
                    </div>

                    {/* Stock Badge / Quick Toggle */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleActive(prod);
                        }}
                        className={clsx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                            prod.is_active
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-600/20"
                                : "bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-600/20"
                        )}
                        title={prod.is_active ? "In Stock. Click to mark Out of Stock" : "Out of Stock. Click to mark In Stock"}
                    >
                        <span
                            className={clsx(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                prod.is_active ? "bg-emerald-500" : "bg-red-500"
                            )}
                        />
                        {prod.is_active ? "In Stock" : "Out of Stock"}
                    </button>
                </div>
            </div>
        </article>
    );
});

export function MenuManagerScreen({ venueId }: { venueId?: string } = {}) {
    const { venue } = useVenue(venueId);
    const [searchParams, setSearchParams] = useSearchParams();

    // Active Tab: "menu" | "categories" | "top-sellers" | "pricing"
    const activeTab = (searchParams.get("tab") as "menu" | "categories" | "top-sellers" | "pricing") || "menu";

    const setTab = (tab: "menu" | "categories" | "top-sellers" | "pricing") => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tab === "menu") next.delete("tab");
            else next.set("tab", tab);
            return next;
        });
    };

    // State (Hydrated synchronously from instant cache with 0ms delay)
    const initialProds = venue.id && venue.id !== "00000000-0000-0000-0000-000000000000"
        ? cacheGet<DbProduct[]>(`products:${venue.id}:all`) || []
        : [];
    const initialCats = venue.id && venue.id !== "00000000-0000-0000-0000-000000000000"
        ? cacheGet<DbMenuCategory[]>(`menu_cats:${venue.id}`) || []
        : [];

    const [products, setProducts] = useState<DbProduct[]>(initialProds);
    const [categories, setCategories] = useState<DbMenuCategory[]>(initialCats);
    const [loading, setLoading] = useState<boolean>(initialProds.length === 0);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "active" | "inactive">("all");

    // Modals & Drawers
    const [editingProduct, setEditingProduct] = useState<Partial<DbProduct> | null>(null);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [pendingDeleteProduct, setPendingDeleteProduct] = useState<DbProduct | null>(null);

    // Category modal
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

    // ── Pricing & Tax (venue-level; drives bill math + inclusive display) ──
    const [vatPct, setVatPct] = useState("12.5");
    const [taxInclusive, setTaxInclusive] = useState(false);
    const [savingTax, setSavingTax] = useState(false);

    useEffect(() => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setVatPct(String(venue.vat_pct ?? 12.5));
        setTaxInclusive(Boolean(venue.tax_inclusive));
    }, [venue.id, venue.vat_pct, venue.tax_inclusive]);

    const handleSaveTax = async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const vat = Math.min(Math.max(parseFloat(vatPct) || 0, 0), 100);
        setSavingTax(true);
        try {
            const { error } = await db.updateVenue(venue.id, {
                service_charge_pct: 0,
                vat_pct: vat,
                tax_inclusive: taxInclusive,
            });
            if (error) throw error;
            setVatPct(String(vat));
            toast.success("Pricing & tax settings saved.");
        } catch (err) {
            console.error("[MenuManager] Tax settings save failed:", err);
            toast.error("Could not save settings — check your connection and try again.");
        } finally {
            setSavingTax(false);
        }
    };

    // Image Upload State inside Form
    const [imagePreview, setImagePreview] = useState<string>("");
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Sales / Top Sellers
    const [rawOrderItems, setRawOrderItems] = useState<Array<{ product_name: string; quantity: number; line_total: number }>>([]);

    // ────────────────────────── Fetch Menu Data ──────────────────────────
    const fetchMenuData = useCallback(async (silent = false) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        if (!silent) setLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                db.products(venue.id, true),
                db.menuCategories(venue.id),
            ]);

            const prods = prodRes.data ?? [];
            const cats = catRes.data ?? [];

            setProducts(prods);
            setCategories(cats);

            // Commit to instant cache
            cacheSet(`products:${venue.id}:all`, prods, TTL.MENU);
            cacheSet(`menu_cats:${venue.id}`, cats, TTL.MENU);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load menu items.");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [venue.id]);

    useEffect(() => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const cachedProds = cacheGet<DbProduct[]>(`products:${venue.id}:all`);
        const cachedCats = cacheGet<DbMenuCategory[]>(`menu_cats:${venue.id}`);
        const hasCache = Boolean(cachedProds && cachedProds.length > 0);

        if (hasCache) {
            setProducts(cachedProds!);
            setLoading(false);
        }
        if (cachedCats && cachedCats.length > 0) {
            setCategories(cachedCats);
        }

        // Silent background fetch if cache was available, otherwise show loading
        fetchMenuData(hasCache);
    }, [venue.id, fetchMenuData]);

    // Fetch order history for top sellers tab
    useEffect(() => {
        if (activeTab !== "top-sellers" || !venue.id) return;
        const fetchOrders = async () => {
            try {
                const { data } = await supabase
                    .from("order_items")
                    .select("product_name, quantity, line_total")
                    .limit(2000);
                setRawOrderItems(data ?? []);
            } catch {
                // ignore
            }
        };
        fetchOrders();
    }, [activeTab, venue.id]);

    // ────────────────────────── Categories Map ──────────────────────────
    const catNameById = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach((c) => map.set(c.id, c.name));
        return map;
    }, [categories]);

    // ────────────────────────── Stock Counts ──────────────────────────
    const activeCount = useMemo(() => products.filter((p) => p.is_active).length, [products]);
    const inactiveCount = useMemo(() => products.filter((p) => !p.is_active).length, [products]);

    // ────────────────────────── Filtered Products ──────────────────────────
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            if (availabilityFilter === "active" && !p.is_active) return false;
            if (availabilityFilter === "inactive" && p.is_active) return false;

            const matchesSearch =
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

            if (!matchesSearch) return false;
            if (selectedCategory === "All") return true;

            const catName = p.category_id ? catNameById.get(p.category_id) : "Uncategorized";
            return catName?.toLowerCase() === selectedCategory.toLowerCase();
        });
    }, [products, search, selectedCategory, availabilityFilter, catNameById]);

    // ────────────────────────── Save / Edit Product ──────────────────────────
    const handleOpenCreateModal = () => {
        setEditingProduct({
            name: "",
            price: 0,
            cost_price: 0,
            category_id: categories.length > 0 ? categories[0].id : null,
            station: "kitchen",
            description: "",
            images: [],
            is_active: true,
        });
        setImagePreview("");
        setIsCreatingProduct(true);
    };

    const handleOpenEditModal = useCallback((prod: DbProduct) => {
        setEditingProduct({ ...prod });
        setImagePreview(prod.images?.[0] || "");
        setIsCreatingProduct(false);
    }, []);

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct || !editingProduct.name || editingProduct.price === undefined || !venue.id) {
            toast.error("Please fill out item name and price.");
            return;
        }

        try {
            const finalImages = imagePreview ? [imagePreview] : editingProduct.images || [];

            if (isCreatingProduct) {
                const { error } = await db.createProduct({
                    venueId: venue.id,
                    categoryId: editingProduct.category_id,
                    name: editingProduct.name,
                    description: editingProduct.description || undefined,
                    price: Number(editingProduct.price),
                    costPrice: editingProduct.cost_price ? Number(editingProduct.cost_price) : undefined,
                    images: finalImages,
                    station: editingProduct.station || "kitchen",
                });
                if (error) throw error;
                toast.success(`Created "${editingProduct.name}"`);
            } else if (editingProduct.id) {
                const { error } = await db.updateProduct(editingProduct.id, venue.id, {
                    name: editingProduct.name,
                    category_id: editingProduct.category_id,
                    price: Number(editingProduct.price),
                    cost_price: editingProduct.cost_price ? Number(editingProduct.cost_price) : null,
                    description: editingProduct.description,
                    station: editingProduct.station,
                    images: finalImages,
                    is_active: editingProduct.is_active,
                });
                if (error) throw error;
                toast.success(`Updated "${editingProduct.name}"`);
            }

            setEditingProduct(null);
            setIsCreatingProduct(false);
            fetchMenuData(true);
        } catch {
            toast.error("Failed to save menu item.");
        }
    };

    // Toggle Product Availability
    const handleToggleActive = useCallback(async (product: DbProduct) => {
        const nextState = !product.is_active;
        setProducts((prev) => {
            const next = prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p));
            if (venue.id) cacheSet(`products:${venue.id}:all`, next, TTL.MENU);
            return next;
        });
        try {
            await db.updateProduct(product.id, venue.id, { is_active: nextState });
            toast.success(`${product.name} is now ${nextState ? "Available (In Stock)" : "Out of Stock"}`);
            fetchMenuData(true);
        } catch {
            fetchMenuData(true);
            toast.error("Failed to update status.");
        }
    }, [venue.id, fetchMenuData]);

    // Delete Product
    const handleDeleteProduct = async () => {
        if (!pendingDeleteProduct || !venue.id) return;
        const toDelete = pendingDeleteProduct;
        setPendingDeleteProduct(null);
        setProducts((prev) => {
            const next = prev.filter((p) => p.id !== toDelete.id);
            if (venue.id) cacheSet(`products:${venue.id}:all`, next, TTL.MENU);
            return next;
        });
        try {
            await db.deleteProduct(toDelete.id, venue.id);
            toast.success(`Deleted ${toDelete.name}`);
            fetchMenuData(true);
        } catch {
            fetchMenuData(true);
            toast.error("Could not delete product.");
        }
    };

    // Category Creation
    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim() || !venue.id) return;
        try {
            const { data, error } = await db.createMenuCategory(venue.id, newCategoryName.trim());
            if (error) throw error;
            toast.success(`Created category "${newCategoryName}"`);
            setNewCategoryName("");
            setIsCategoryModalOpen(false);
            fetchMenuData(true);
        } catch {
            toast.error("Failed to create category.");
        }
    };

    // Image File Selection
    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            try {
                const res = await uploadToR2(file, venue.id, "products");
                setImagePreview(res.url);
                toast.success("Photo uploaded successfully!");
            } catch {
                const reader = new FileReader();
                reader.onload = () => {
                    setImagePreview(reader.result as string);
                    toast.success("Photo attached!");
                };
                reader.readAsDataURL(file);
            }
        } finally {
            setIsUploadingImage(false);
        }
    };

    // Top Sellers List
    const topSellersList = useMemo(() => {
        const statsMap = new Map<string, { quantity: number; revenue: number }>();
        for (const item of rawOrderItems) {
            const existing = statsMap.get(item.product_name) || { quantity: 0, revenue: 0 };
            statsMap.set(item.product_name, {
                quantity: existing.quantity + item.quantity,
                revenue: existing.revenue + (item.line_total || 0),
            });
        }

        const result: Array<{ name: string; quantity: number; revenue: number; price: number }> = [];
        statsMap.forEach((val, name) => {
            const matchedProd = products.find((p) => p.name.toLowerCase() === name.toLowerCase());
            result.push({
                name,
                quantity: val.quantity,
                revenue: val.revenue,
                price: matchedProd ? matchedProd.price : val.quantity > 0 ? val.revenue / val.quantity : 0,
            });
        });

        return result.sort((a, b) => b.revenue - a.revenue);
    }, [rawOrderItems, products]);

    return (
        <div className="min-h-screen bg-isabelline text-licorice font-sans antialiased pb-16">
            {/* ═══════════════════════════════════════════════════════════
                HEADER BAR
              ═══════════════════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-licorice/8 bg-white px-6 py-5 shadow-xs">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-black tracking-tight text-licorice">
                            Menu & Catalog Management
                        </h1>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-isabelline px-4 py-2.5 text-xs font-bold text-licorice ring-1 ring-licorice/8 hover:bg-licorice/5 active:scale-95 transition-all"
                        >
                            <TagIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                            Add Category
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-licorice px-4.5 py-2.5 text-xs font-bold tracking-tight text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] hover:bg-licorice/95 active:scale-95 transition-all"
                        >
                            <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                            Add Menu Item
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mx-auto mt-4 flex max-w-7xl items-center gap-2 border-t border-licorice/8 pt-3">
                    <button
                        type="button"
                        onClick={() => setTab("menu")}
                        className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold tracking-tight transition-all duration-150",
                            activeTab === "menu"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                        )}
                    >
                        <CubeIcon className="h-4 w-4" strokeWidth={2} />
                        Menu Items ({products.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("categories")}
                        className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold tracking-tight transition-all duration-150",
                            activeTab === "categories"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                        )}
                    >
                        <TagIcon className="h-4 w-4" strokeWidth={2} />
                        Categories ({categories.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("top-sellers")}
                        className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold tracking-tight transition-all duration-150",
                            activeTab === "top-sellers"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                        )}
                    >
                        <ChartBarIcon className="h-4 w-4" strokeWidth={2} />
                        Sales Performance
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("pricing")}
                        className={clsx(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold tracking-tight transition-all duration-150",
                            activeTab === "pricing"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:bg-isabelline hover:text-licorice"
                        )}
                    >
                        <BanknotesIcon className="h-4 w-4" strokeWidth={2} />
                        Pricing & Tax
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                TAB 1: MENU ITEMS CATALOG
              ═══════════════════════════════════════════════════════════ */}
            {activeTab === "menu" && (
                <main className="mx-auto max-w-7xl pt-6">
                    {/* Search & Category Filter Bar */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* Search input */}
                            <div className="relative flex-1 max-w-md">
                                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-feldgrau" strokeWidth={2} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search menu items, ingredients, descriptions…"
                                    className="w-full rounded-xl bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20 shadow-xs placeholder:text-feldgrau/50 transition-all"
                                />
                            </div>

                            {/* Stock Availability Filter Chips */}
                            <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-licorice/8 shrink-0 self-start sm:self-auto shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setAvailabilityFilter("all")}
                                    className={clsx(
                                        "rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all",
                                        availabilityFilter === "all"
                                            ? "bg-licorice text-isabelline shadow-xs"
                                            : "text-feldgrau hover:text-licorice"
                                    )}
                                >
                                    All ({products.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAvailabilityFilter("active")}
                                    className={clsx(
                                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all",
                                        availabilityFilter === "active"
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "text-feldgrau hover:text-emerald-700"
                                    )}
                                >
                                    <span className={clsx("h-1.5 w-1.5 rounded-full", availabilityFilter === "active" ? "bg-white" : "bg-emerald-500")} />
                                    In Stock ({activeCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAvailabilityFilter("inactive")}
                                    className={clsx(
                                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all",
                                        availabilityFilter === "inactive"
                                            ? "bg-red-600 text-white shadow-xs"
                                            : "text-feldgrau hover:text-red-700"
                                    )}
                                >
                                    <span className={clsx("h-1.5 w-1.5 rounded-full", availabilityFilter === "inactive" ? "bg-white" : "bg-red-500")} />
                                    Out of Stock ({inactiveCount})
                                </button>
                            </div>
                        </div>

                        {/* Category Filter Chips */}
                        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("All")}
                                className={clsx(
                                    "rounded-lg px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all shrink-0",
                                    selectedCategory === "All"
                                        ? "bg-licorice text-isabelline shadow-xs"
                                        : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice hover:bg-isabelline"
                                )}
                            >
                                All Categories ({products.length})
                            </button>
                            {categories.map((c) => {
                                const count = products.filter((p) => p.category_id === c.id).length;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(c.name)}
                                        className={clsx(
                                            "rounded-lg px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all shrink-0",
                                            selectedCategory.toLowerCase() === c.name.toLowerCase()
                                                ? "bg-licorice text-isabelline shadow-xs"
                                                : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice hover:bg-isabelline"
                                        )}
                                    >
                                        {c.name} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Products Grid */}
                    {loading ? (
                        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-licorice/8">
                            <ArrowPathIcon className="h-6 w-6 animate-spin text-feldgrau" strokeWidth={2} />
                            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-feldgrau">Loading Menu Catalog…</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-20 text-center shadow-sm ring-1 ring-licorice/8">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-isabelline text-feldgrau">
                                <CubeIcon className="h-6 w-6" strokeWidth={2} />
                            </div>
                            <h3 className="mt-4 text-sm font-bold tracking-tight text-licorice">No menu items found</h3>
                            <p className="mt-1 max-w-sm text-xs leading-relaxed text-feldgrau">
                                {products.length === 0
                                    ? "Your venue menu is currently empty. Add your first dish or drink."
                                    : "No items match your search or category filter."}
                            </p>
                            <div className="mt-6 flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleOpenCreateModal}
                                    className="rounded-xl bg-licorice px-4 py-2.5 text-xs font-bold text-isabelline shadow-sm hover:bg-licorice/95 active:scale-95 transition-all"
                                >
                                    Add Menu Item
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-start">
                            {filteredProducts.map((prod) => {
                                const catName = prod.category_id ? catNameById.get(prod.category_id) : "Uncategorized";
                                const marginPct =
                                    prod.cost_price && prod.cost_price > 0
                                        ? Math.round(((prod.price - prod.cost_price) / prod.price) * 100)
                                        : null;

                                return (
                                    <InventoryProductCard
                                        key={prod.id}
                                        prod={prod}
                                        catName={catName || "Uncategorized"}
                                        marginPct={marginPct}
                                        onEdit={handleOpenEditModal}
                                        onToggleActive={handleToggleActive}
                                    />
                                );
                            })}
                        </div>
                    )}
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 2: CATEGORIES MANAGEMENT
              ═══════════════════════════════════════════════════════════ */}
            {activeTab === "categories" && (
                <main className="mx-auto max-w-4xl px-6 pt-6">
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-licorice/8">
                        <div className="flex items-center justify-between border-b border-licorice/8 pb-4">
                            <div>
                                <h3 className="text-base font-bold tracking-tight text-licorice">Menu Categories</h3>
                                <p className="text-xs text-feldgrau">Organize your menu sections for guests & waiter POS.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-licorice px-4 py-2.5 text-xs font-bold text-isabelline shadow-sm hover:bg-licorice/95 active:scale-95 transition-all"
                            >
                                <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                                Add Category
                            </button>
                        </div>

                        <div className="mt-4 divide-y divide-licorice/8">
                            {categories.map((cat) => {
                                const itemCount = products.filter((p) => p.category_id === cat.id).length;
                                return (
                                    <div key={cat.id} className="flex items-center justify-between py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
                                                <TagIcon className="h-4 w-4" strokeWidth={2} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold tracking-tight text-licorice">{cat.name}</h4>
                                                <p className="text-xs text-feldgrau">{itemCount} items in category</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                                                    await db.deleteMenuCategory(cat.id, venue.id);
                                                    toast.success("Category deleted.");
                                                    fetchMenuData();
                                                }
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                                        >
                                            <TrashIcon className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 3: SALES PERFORMANCE
              ═══════════════════════════════════════════════════════════ */}
            {/* ═══════════════════════════════════════════════════════════
                TAB 4: PRICING & TAX (venue-level)
              ═══════════════════════════════════════════════════════════ */}
            {activeTab === "pricing" && (
                <main className="mx-auto max-w-3xl px-6 pt-6 pb-16">
                    <div className="rounded-2xl border border-licorice/8 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold tracking-tight text-licorice">Pricing & Tax</h2>
                        <p className="mt-1 max-w-lg text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                            VAT is applied to guest bills based on your venue settings. Set to 0% if your venue is not registered for VAT.
                        </p>

                        <div className="mt-6 max-w-xs">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-feldgrau">
                                    VAT Rate (%)
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={vatPct}
                                    onChange={(e) => setVatPct(e.target.value)}
                                    disabled={savingTax}
                                    className="rounded-lg border border-licorice/10 bg-isabelline px-3.5 py-2.5 font-mono text-sm font-bold tabular-nums text-licorice outline-none focus:ring-2 focus:ring-khaki disabled:opacity-60"
                                />
                            </label>
                        </div>

                        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-licorice/8 bg-isabelline p-4">
                            <input
                                type="checkbox"
                                checked={taxInclusive}
                                onChange={(e) => setTaxInclusive(e.target.checked)}
                                disabled={savingTax}
                                className="mt-0.5 h-4 w-4 accent-licorice"
                            />
                            <span className="flex flex-col gap-0.5">
                                <span className="text-[13px] font-bold tracking-tight text-licorice">
                                    Show tax-inclusive prices to guests
                                </span>
                                <span className="text-[11.5px] leading-[1.5] tracking-tight text-feldgrau">
                                    Menu, item details and the cart pill will display prices with service & VAT
                                    already included, so guests see the exact amount they'll pay. When off, base
                                    prices are shown and taxes appear as separate lines at checkout.
                                </span>
                            </span>
                        </label>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleSaveTax}
                                disabled={savingTax}
                                className="inline-flex items-center gap-2 rounded-lg bg-licorice px-5 py-2.5 text-xs font-bold tracking-tight text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)] transition-all hover:bg-licorice/90 active:scale-95 disabled:opacity-70"
                            >
                                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                {savingTax ? "Saving…" : "Save Settings"}
                            </button>
                        </div>
                    </div>
                </main>
            )}

            {activeTab === "top-sellers" && (
                <main className="mx-auto max-w-7xl px-6 pt-6">
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-licorice/8">
                        <div className="flex items-center justify-between border-b border-licorice/8 pb-4">
                            <div>
                                <h3 className="text-base font-bold tracking-tight text-licorice">Top Selling Items</h3>
                                <p className="text-xs text-feldgrau">Sales volume and revenue performance by menu item.</p>
                            </div>
                        </div>

                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-licorice/8 uppercase tracking-wider text-feldgrau font-bold">
                                        <th className="py-3 px-3">Rank</th>
                                        <th className="py-3 px-3">Menu Item</th>
                                        <th className="py-3 px-3 text-right">Units Sold</th>
                                        <th className="py-3 px-3 text-right">Selling Price</th>
                                        <th className="py-3 px-3 text-right">Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-licorice/5 font-medium">
                                    {topSellersList.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-feldgrau font-bold">
                                                No order sales recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        topSellersList.map((item, idx) => (
                                            <tr key={item.name} className="hover:bg-isabelline/60 transition-colors">
                                                <td className="py-3.5 px-3 font-bold text-licorice">#{idx + 1}</td>
                                                <td className="py-3.5 px-3 font-bold text-licorice">{item.name}</td>
                                                <td className="py-3.5 px-3 text-right font-mono font-bold">{item.quantity}</td>
                                                <td className="py-3.5 px-3 text-right font-mono">{formatGHS(item.price)}</td>
                                                <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                                                    {formatGHS(item.revenue)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════
                ADD / EDIT MENU ITEM MODAL
              ═══════════════════════════════════════════════════════════ */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-licorice/50 backdrop-blur-xs" onClick={() => setEditingProduct(null)} />

                    <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto no-scrollbar rounded-[1.5rem] bg-white p-6 shadow-2xl ring-1 ring-licorice/10">
                        <div className="flex items-center justify-between border-b border-licorice/8 pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase text-khaki">
                                    {isCreatingProduct ? "Add New Item" : "Edit Menu Item"}
                                </p>
                                <h3 className="text-lg font-bold tracking-tight text-licorice">
                                    {isCreatingProduct ? "New Menu Item" : editingProduct.name}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingProduct(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice hover:bg-licorice/10"
                            >
                                <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="mt-5 space-y-4">
                            {/* Item Name */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                    Item Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingProduct.name || ""}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                    placeholder="e.g. Crispy Honey Wings"
                                    className="w-full rounded-xl border border-licorice/10 bg-white px-3.5 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none focus:ring-1 focus:ring-licorice"
                                />
                            </div>

                            {/* Category & Station Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={editingProduct.category_id || ""}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                                        className="w-full rounded-xl border border-licorice/10 bg-white px-3 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                        Prep Station
                                    </label>
                                    <select
                                        value={editingProduct.station || "kitchen"}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, station: e.target.value as "kitchen" | "bar" })}
                                        className="w-full rounded-xl border border-licorice/10 bg-white px-3 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none"
                                    >
                                        <option value="kitchen">Kitchen (Food)</option>
                                        <option value="bar">Bar (Drinks)</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                            </div>

                            {/* Prices */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                        Selling Price (GH₵) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={editingProduct.price || ""}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                                        placeholder="85.00"
                                        className="w-full rounded-xl border border-licorice/10 bg-white px-3.5 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                        Cost Price (GH₵)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingProduct.cost_price || ""}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                                        placeholder="32.00"
                                        className="w-full rounded-xl border border-licorice/10 bg-white px-3.5 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none font-mono"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    value={editingProduct.description || ""}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                                    placeholder="Brief description of dish or drink ingredients…"
                                    className="w-full rounded-xl border border-licorice/10 bg-white px-3.5 py-2.5 text-xs text-licorice focus:border-licorice focus:outline-none"
                                />
                            </div>

                            {/* Image Attachment */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-feldgrau mb-1.5">
                                    Item Photo
                                </label>

                                {imagePreview ? (
                                    <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-2xl border border-licorice/10 bg-isabelline shadow-xs group">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="h-full w-full object-cover"
                                        />

                                        {/* Top-Right: Remove (X) Button */}
                                        <button
                                            type="button"
                                            onClick={() => setImagePreview("")}
                                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow-md hover:bg-red-600 transition-colors"
                                            title="Remove Photo"
                                        >
                                            <XMarkIcon className="h-4 w-4" strokeWidth={2.5} />
                                        </button>

                                        {/* Bottom-Right CTA: White plus inside a black circle */}
                                        <label
                                            className="absolute bottom-3 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black text-white shadow-xl ring-2 ring-white/90 hover:scale-105 active:scale-95 transition-all"
                                            title="Change / Upload New Photo"
                                        >
                                            <PlusIcon className="h-5 w-5 text-white stroke-[2.5]" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageFileChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <label className="flex h-56 sm:h-64 w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-licorice/15 bg-isabelline/50 p-6 text-center hover:bg-licorice/5 hover:border-licorice/30 transition-all">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-licorice/5 text-licorice">
                                            <PhotoIcon className="h-6 w-6 text-licorice" strokeWidth={1.75} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-licorice">
                                                {isUploadingImage ? "Uploading Photo…" : "Upload Photo File"}
                                            </p>
                                            <p className="text-[11px] text-feldgrau mt-0.5">PNG, JPG, or WEBP up to 5MB</p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Item Availability Toggle */}
                            <div className="flex items-center justify-between rounded-xl border border-licorice/10 bg-isabelline/60 px-3.5 py-2.5">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-feldgrau">
                                        Item Availability
                                    </label>
                                    <p className="text-[11px] font-semibold text-licorice">
                                        {editingProduct.is_active !== false ? "In Stock (Available for Ordering)" : "Out of Stock (Hidden from POS & Menu)"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingProduct({ ...editingProduct, is_active: !editingProduct.is_active })}
                                    className={clsx(
                                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                        editingProduct.is_active !== false ? "bg-emerald-600" : "bg-licorice/20"
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                            editingProduct.is_active !== false ? "translate-x-5" : "translate-x-0"
                                        )}
                                    />
                                </button>
                            </div>

                            {/* Submit & Actions */}
                            <div className="pt-3 flex items-center justify-between border-t border-licorice/8">
                                {editingProduct.id ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const toDelete = editingProduct as DbProduct;
                                            setEditingProduct(null);
                                            setPendingDeleteProduct(toDelete);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                                    >
                                        <TrashIcon className="h-4 w-4" strokeWidth={2} />
                                        Delete Product
                                    </button>
                                ) : (
                                    <div />
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingProduct(null)}
                                        className="rounded-xl px-4 py-2.5 text-xs font-bold text-feldgrau hover:text-licorice cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-licorice px-5 py-2.5 text-xs font-bold text-isabelline shadow-sm hover:bg-licorice/95 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Save Menu Item
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                ADD CATEGORY MODAL
              ═══════════════════════════════════════════════════════════ */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-licorice/50 backdrop-blur-xs" onClick={() => setIsCategoryModalOpen(false)} />

                    <div className="relative w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white p-6 shadow-2xl ring-1 ring-licorice/10">
                        <p className="text-xs font-bold uppercase text-khaki">New Category</p>
                        <h3 className="text-base font-bold text-licorice">Add Menu Section</h3>
                        <p className="mt-0.5 text-xs text-feldgrau">e.g. Starters, Signature Cocktails, Grill, Desserts</p>

                        <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
                            <input
                                type="text"
                                required
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Category Name"
                                className="w-full rounded-xl border border-licorice/10 bg-white px-3.5 py-2.5 text-xs font-bold text-licorice focus:border-licorice focus:outline-none"
                            />

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCategoryModalOpen(false)}
                                    className="rounded-xl px-4 py-2 text-xs font-bold text-feldgrau"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-licorice px-4 py-2 text-xs font-bold text-isabelline shadow-sm"
                                >
                                    Create Category
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {pendingDeleteProduct && (
                <ConfirmModal
                    isOpen={Boolean(pendingDeleteProduct)}
                    title="Delete Menu Item"
                    body={`Are you sure you want to delete "${pendingDeleteProduct.name}" from your POS menu?`}
                    confirmLabel="Delete Item"
                    isDanger={true}
                    onConfirm={handleDeleteProduct}
                    onClose={() => setPendingDeleteProduct(null)}
                />
            )}

            {/* Bulk Menu Upload (CSV / Excel) */}
            <BulkMenuUploadModal
                isOpen={isBulkUploadOpen}
                onClose={() => setIsBulkUploadOpen(false)}
                venueId={venue.id}
                existingCategories={categories}
                onSuccess={fetchMenuData}
            />
        </div>
    );
}
