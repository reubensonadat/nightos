import { useCallback, useEffect, useMemo, useState } from "react";
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
    SparklesIcon,
    TrashIcon,
    XMarkIcon,
    PhotoIcon,
    TagIcon,
    ChartBarIcon,
    FunnelIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbProduct, type DbMenuCategory } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../hooks/useVenue";
import clsx from "clsx";
import { ConfirmModal } from "../../components/ConfirmModal";
import { uploadToR2 } from "../../lib/r2";

/* ────────────────────────── Preset Food & Drink Images ────────────────────────── */
const PRESET_IMAGES = [
    { label: "Chicken Wings", url: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80" },
    { label: "Steak / Grill", url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
    { label: "Burger", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80" },
    { label: "Fries", url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80" },
    { label: "Cocktail", url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80" },
    { label: "Beer Draft", url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80" },
    { label: "Red Wine", url: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80" },
    { label: "Dessert", url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80" },
];

/* ────────────────────────── Seed Menu Items Fallback ────────────────────────── */
const DEFAULT_SEED_CATEGORIES = ["Starters", "Mains", "Cocktails", "Beer & Wine", "Desserts"];

const DEFAULT_SEED_PRODUCTS = [
    { name: "Crispy Honey Wings", category: "Starters", price: 85, costPrice: 32, station: "kitchen", description: "Honey glazed wings served with garlic ranch dip", image: PRESET_IMAGES[0].url },
    { name: "Prime Ribeye Steak", category: "Mains", price: 280, costPrice: 110, station: "kitchen", description: "400g grilled ribeye with truffle herb butter", image: PRESET_IMAGES[1].url },
    { name: "Signature House Burger", category: "Mains", price: 140, costPrice: 48, station: "kitchen", description: "Double wagyu patty, smoked cheddar, brioche bun", image: PRESET_IMAGES[2].url },
    { name: "Truffle Parmesan Fries", category: "Starters", price: 65, costPrice: 18, station: "kitchen", description: "Hand-cut fries tossed in truffle oil and parmesan", image: PRESET_IMAGES[3].url },
    { name: "Passion Fruit Mojito", category: "Cocktails", price: 95, costPrice: 22, station: "bar", description: "White rum, fresh passion fruit, mint, lime, soda", image: PRESET_IMAGES[4].url },
    { name: "Craft IPA Draft", category: "Beer & Wine", price: 55, costPrice: 18, station: "bar", description: "Local cold brewed IPA on tap", image: PRESET_IMAGES[5].url },
    { name: "Chocolate Lava Cake", category: "Desserts", price: 75, costPrice: 25, station: "kitchen", description: "Warm molten chocolate cake with vanilla bean ice cream", image: PRESET_IMAGES[7].url },
];

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

    // State
    const [products, setProducts] = useState<DbProduct[]>([]);
    const [categories, setCategories] = useState<DbMenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");

    // Modals & Drawers
    const [editingProduct, setEditingProduct] = useState<Partial<DbProduct> | null>(null);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [pendingDeleteProduct, setPendingDeleteProduct] = useState<DbProduct | null>(null);

    // Category modal
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

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
    const fetchMenuData = useCallback(async () => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        setLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                db.products(venue.id),
                db.menuCategories(venue.id),
            ]);

            setProducts(prodRes.data ?? []);
            setCategories(catRes.data ?? []);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load menu items.");
        } finally {
            setLoading(false);
        }
    }, [venue.id]);

    useEffect(() => {
        fetchMenuData();
    }, [fetchMenuData]);

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

    // ────────────────────────── Seed Menu Action ──────────────────────────
    const handleSeedDefaultMenu = async () => {
        if (!venue.id) return;
        setLoading(true);
        try {
            // 1. Create categories
            const catMap = new Map<string, string>();
            for (const catName of DEFAULT_SEED_CATEGORIES) {
                const existing = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
                if (existing) {
                    catMap.set(catName, existing.id);
                } else {
                    const { data } = await db.createMenuCategory(venue.id, catName);
                    if (data) catMap.set(catName, data.id);
                }
            }

            // 2. Create products
            for (const item of DEFAULT_SEED_PRODUCTS) {
                const catId = catMap.get(item.category) || null;
                await db.createProduct({
                    venueId: venue.id,
                    categoryId: catId,
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    costPrice: item.costPrice,
                    images: [item.image],
                    station: item.station as "kitchen" | "bar",
                });
            }

            toast.success("Default menu items seeded successfully!");
            await fetchMenuData();
        } catch {
            toast.error("Could not seed menu.");
        } finally {
            setLoading(false);
        }
    };

    // ────────────────────────── Categories Map ──────────────────────────
    const catNameById = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach((c) => map.set(c.id, c.name));
        return map;
    }, [categories]);

    // ────────────────────────── Filtered Products ──────────────────────────
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch =
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

            if (!matchesSearch) return false;
            if (selectedCategory === "All") return true;

            const catName = p.category_id ? catNameById.get(p.category_id) : "Uncategorized";
            return catName?.toLowerCase() === selectedCategory.toLowerCase();
        });
    }, [products, search, selectedCategory, catNameById]);

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

    const handleOpenEditModal = (prod: DbProduct) => {
        setEditingProduct({ ...prod });
        setImagePreview(prod.images?.[0] || "");
        setIsCreatingProduct(false);
    };

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
            fetchMenuData();
        } catch {
            toast.error("Failed to save menu item.");
        }
    };

    // Toggle Product Availability
    const handleToggleActive = async (product: DbProduct) => {
        const nextState = !product.is_active;
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p)));
        try {
            await db.updateProduct(product.id, venue.id, { is_active: nextState });
            toast.success(`${product.name} is now ${nextState ? "Available" : "Out of Stock"}`);
        } catch {
            fetchMenuData();
            toast.error("Failed to update status.");
        }
    };

    // Delete Product
    const handleDeleteProduct = async () => {
        if (!pendingDeleteProduct || !venue.id) return;
        try {
            await db.deleteProduct(pendingDeleteProduct.id, venue.id);
            toast.success(`Deleted ${pendingDeleteProduct.name}`);
            setPendingDeleteProduct(null);
            fetchMenuData();
        } catch {
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
            fetchMenuData();
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
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-khaki">
                                POS Menu Catalog
                            </span>
                            <span className="text-xs font-semibold text-feldgrau/60">• {products.length} Active Products</span>
                        </div>
                        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-licorice">
                            Menu & Catalog Management
                        </h1>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {products.length === 0 && (
                            <button
                                type="button"
                                onClick={handleSeedDefaultMenu}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-khaki/20 px-4 py-2.5 text-xs font-bold text-licorice ring-1 ring-khaki/40 hover:bg-khaki/30 active:scale-95 transition-all"
                            >
                                <SparklesIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                Seed Default Menu
                            </button>
                        )}
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
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                                All Items ({products.length})
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
                                    ? "Your venue menu is currently empty. Add your first dish/drink or seed the default menu items."
                                    : "No items match your search or category filter."}
                            </p>
                            <div className="mt-6 flex items-center gap-2.5">
                                {products.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={handleSeedDefaultMenu}
                                        className="rounded-xl bg-khaki/20 px-4 py-2.5 text-xs font-bold text-licorice ring-1 ring-khaki/40 hover:bg-khaki/30 active:scale-95 transition-all"
                                    >
                                        Seed Default Menu
                                    </button>
                                )}
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
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProducts.map((prod) => {
                                const catName = prod.category_id ? catNameById.get(prod.category_id) : "Uncategorized";
                                const marginPct =
                                    prod.cost_price && prod.cost_price > 0
                                        ? Math.round(((prod.price - prod.cost_price) / prod.price) * 100)
                                        : null;

                                return (
                                    <div
                                        key={prod.id}
                                        className={clsx(
                                            "group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-all duration-150 hover:shadow-md hover:ring-licorice/20",
                                            prod.is_active ? "ring-licorice/8" : "bg-isabelline/60 ring-licorice/5 opacity-75"
                                        )}
                                    >
                                        {/* Image Frame */}
                                        <div className="relative h-44 w-full overflow-hidden bg-isabelline">
                                            {prod.images?.[0] ? (
                                                <img
                                                    src={prod.images[0]}
                                                    alt={prod.name}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-feldgrau/30">
                                                    <PhotoIcon className="h-10 w-10" strokeWidth={1.5} />
                                                </div>
                                            )}

                                            {/* Category Badge (Left) */}
                                            <div className="absolute left-3 top-3 flex items-center gap-1.5 z-10">
                                                <span className="inline-flex h-6 items-center rounded-full bg-licorice/90 px-2.5 text-[10px] font-bold text-isabelline shadow-xs backdrop-blur-xs">
                                                    {catName}
                                                </span>
                                                {!prod.is_active && (
                                                    <span className="inline-flex h-6 items-center rounded-full bg-red-600 px-2.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                                                        Out of Stock
                                                    </span>
                                                )}
                                            </div>

                                            {/* Allotted Station Badge (Right) */}
                                            <div className="absolute right-3 top-3 z-10">
                                                <span className="inline-flex h-6 items-center rounded-full bg-white/95 px-2.5 text-[10px] font-bold uppercase tracking-wider text-licorice shadow-xs ring-1 ring-licorice/10 backdrop-blur-xs">
                                                    {prod.station || "kitchen"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex flex-1 flex-col justify-between p-4">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="text-[15px] font-bold tracking-tight text-licorice line-clamp-1">
                                                        {prod.name}
                                                    </h4>
                                                    <span className="font-mono text-base font-black text-licorice shrink-0">
                                                        {formatGHS(prod.price)}
                                                    </span>
                                                </div>

                                                {prod.description && (
                                                    <p className="mt-1 text-xs leading-relaxed text-feldgrau line-clamp-2">
                                                        {prod.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Footer Actions & Cost */}
                                            <div className="mt-4 flex items-center justify-between border-t border-licorice/8 pt-3">
                                                <div className="text-[11px] text-feldgrau">
                                                    {prod.cost_price ? (
                                                        <span>
                                                            Cost: <span className="font-mono font-semibold">{formatGHS(prod.cost_price)}</span>
                                                            {marginPct !== null && (
                                                                <span className="ml-1 font-bold text-emerald-700">({marginPct}%)</span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="italic text-feldgrau/50">No cost set</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(prod)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-isabelline text-licorice hover:bg-licorice hover:text-isabelline transition-colors"
                                                        title="Edit menu item"
                                                    >
                                                        <PencilSquareIcon className="h-4 w-4" strokeWidth={2} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeleteProduct(prod)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                                                        title="Delete item"
                                                    >
                                                        <TrashIcon className="h-4 w-4" strokeWidth={2} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
                                <label className="block text-xs font-bold uppercase text-feldgrau mb-1">
                                    Item Photo
                                </label>

                                {imagePreview && (
                                    <div className="relative mb-2 h-32 w-full overflow-hidden rounded-xl border border-licorice/10 bg-isabelline">
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setImagePreview("")}
                                            className="absolute right-2 top-2 rounded-full bg-licorice/80 p-1 text-white hover:bg-red-600 transition-colors"
                                        >
                                            <XMarkIcon className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-licorice/20 bg-isabelline p-3 text-xs font-bold text-licorice hover:bg-licorice/5 transition-colors">
                                        <PhotoIcon className="h-4 w-4 text-feldgrau" strokeWidth={2} />
                                        {isUploadingImage ? "Uploading…" : "Upload Photo File"}
                                        <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                    </label>

                                    {/* Preset Selector */}
                                    <p className="text-[10px] font-bold uppercase text-feldgrau mt-1">
                                        Or Select Preset Image:
                                    </p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {PRESET_IMAGES.map((preset) => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setImagePreview(preset.url)}
                                                className="group relative h-14 overflow-hidden rounded-lg border border-licorice/10 focus:ring-2 focus:ring-licorice"
                                            >
                                                <img src={preset.url} alt={preset.label} className="h-full w-full object-cover group-hover:scale-105" />
                                                <span className="absolute inset-0 flex items-center justify-center bg-licorice/50 text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {preset.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
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

                            {/* Submit */}
                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-licorice/8">
                                <button
                                    type="button"
                                    onClick={() => setEditingProduct(null)}
                                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-feldgrau hover:text-licorice"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-licorice px-5 py-2.5 text-xs font-bold text-isabelline shadow-sm hover:bg-licorice/95 active:scale-95 transition-all"
                                >
                                    Save Menu Item
                                </button>
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
        </div>
    );
}
