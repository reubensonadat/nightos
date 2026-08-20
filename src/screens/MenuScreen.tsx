import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    HeartIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    PlusIcon,
    UserIcon,
} from "@heroicons/react/24/outline";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { formatGHS, formatGHSString } from "../data/menu";
import type { MenuCategory, MenuItem, ModifierGroup } from "../data/menu";
import { MenuItemCard } from "../components/MenuItemCard";
import { useCart } from "../context/CartContext";
import { ItemDetailsSheet } from "../components/ItemDetailsSheet";
import { db, type DbProduct, type DbModifierOption } from "../lib/api";
import { supabase } from "../lib/supabase";

type Props = {
    venueId?: string;
    venueName?: string | null;
    tableLabel?: string | null;
    waiterName?: string | null;
    onBack?: () => void;
    onViewCart?: () => void;
};

async function fetchProducts(venueId: string): Promise<MenuItem[]> {
    const { data, error } = await db.products(venueId);
    if (error || !data) return [];

    // Fetch categories for mapping
    const { data: categories } = await db.menuCategories(venueId);
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

    // Fetch all modifier infrastructure in one batch
    const productIds = data.map(p => p.id);
    const [groupsResult, linksResult] = await Promise.all([
        db.modifierGroups(venueId),
        productIds.length > 0
            ? supabase.from('product_modifiers').select('product_id, group_id').in('product_id', productIds)
            : { data: [] },
    ]);
    const allGroups = groupsResult.data ?? [];
    const links = (linksResult.data ?? []) as { product_id: string; group_id: string }[];

    // Product → group IDs map
    const productGroupIds = new Map<string, string[]>();
    for (const link of links) {
        if (!productGroupIds.has(link.product_id)) productGroupIds.set(link.product_id, []);
        productGroupIds.get(link.product_id)!.push(link.group_id);
    }

    // Fetch all options for all referenced groups in one call
    const allGroupIds = [...new Set(links.map(l => l.group_id))];
    const optionsResult = allGroupIds.length > 0
        ? await db.modifierOptions(allGroupIds)
        : { data: [] };
    const allOptions = (optionsResult.data ?? []) as DbModifierOption[];

    // Group → options map
    const groupOptions = new Map<string, DbModifierOption[]>();
    for (const opt of allOptions) {
        if (!groupOptions.has(opt.group_id)) groupOptions.set(opt.group_id, []);
        groupOptions.get(opt.group_id)!.push(opt);
    }

    return data.map((p: DbProduct) => {
        const gids = productGroupIds.get(p.id) ?? [];
        return {
            id: p.id,
            name: p.name,
            description: p.description || '',
            longDescription: p.long_description || undefined,
            price: p.price,
            category: p.category_id ? categoryMap.get(p.category_id) || "Other" : "Other",
            station: p.station,
            image: p.images?.[0] || '',
            tags: ((p.tags ?? []) as string[]).filter((t) =>
                ['Popular', 'New', "Chef's Pick", 'Vegetarian'].includes(t)
            ) as MenuItem['tags'] | undefined,
            abv: p.abv || undefined,
            origin: p.origin || undefined,
            modifiers: gids.map(gid => {
                const g = allGroups.find(g => g.id === gid);
                const opts = groupOptions.get(gid) ?? [];
                return {
                    id: g?.id ?? gid,
                    title: g?.name ?? '',
                    required: g?.required ?? false,
                    multiSelect: g?.multi_select ?? false,
                    max: g?.max_select ?? undefined,
                    options: opts.map(o => ({
                        id: o.id,
                        name: o.name,
                        priceDelta: o.price_delta || undefined,
                    })),
                } satisfies ModifierGroup;
            }),
        };
    });

}

export function MenuScreen({ venueId, venueName, tableLabel, waiterName, onBack, onViewCart }: Props) {
    const [active, setActive] = useState<MenuCategory>("Signatures");
    const [query, setQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { addQuick, subtotal, itemCount, toggleFavorite, isFavorite } =
        useCart();

    useEffect(() => {
        if (!venueId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchProducts(venueId).then(items => {
            setMenuItems(items);
            setLoading(false);
        });
    }, [venueId]);

    const items = menuItems;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const categories: MenuCategory[] = [...new Set(items.map(i => i.category))];

    // Ensure active category still exists after data loads
    useEffect(() => {
        if (categories.length > 0 && !categories.includes(active)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActive(categories[0]);
        }
    }, [categories, active]);

    const visibleItems = useMemo<MenuItem[]>(() => {
        const q = query.trim().toLowerCase();
        let filtered = items.filter((m) => m.category === active);
        if (q) {
            filtered = filtered.filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    m.description.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [active, query, items]);

    const activeItem = activeItemId
        ? items.find((m) => m.id === activeItemId) ?? null
        : null;

    const gridItems = visibleItems;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER — clean, like a printed menu
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                {/* ── Top Bar ── */}
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),14px)] pb-2">
                    <div className="flex items-center gap-2.5">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                aria-label="Back"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                            >
                                <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        )}
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]">
                                <span className="font-serif text-[15px] font-bold leading-none tracking-tight">
                                    V
                                </span>
                            </div>
                            <div className="flex flex-col leading-tight">
                                <span className="text-[13px] font-bold tracking-tight text-licorice">
                                    {venueName || "Velvet Lounge"}
                                </span>
                                {tableLabel && (
                                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                                        Table {tableLabel}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {tableLabel && (
                            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-licorice/8">
                                <MapPinIcon className="h-3 w-3 text-dark-red" strokeWidth={2.25} />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-licorice">
                                    T·{tableLabel}
                                </span>
                            </div>
                        )}
                        {waiterName && (
                            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-licorice/8">
                                <UserIcon className="h-3 w-3 text-khaki" strokeWidth={2.25} />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-licorice">
                                    {waiterName}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setSearchOpen((v) => !v)}
                            aria-label={searchOpen ? "Close search" : "Open search"}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                        >
                        <MagnifyingGlassIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    </div>
                </div>

                {/* Search input */}
                {searchOpen && (
                <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3 animate-velvet-fade">
                    <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-licorice/8">
                        <MagnifyingGlassIcon
                            className="h-4 w-4 text-feldgrau"
                            strokeWidth={2.25}
                        />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search cocktails, wines, plates…"
                            className="flex-1 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/70 focus:outline-none"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="text-[10px] font-bold uppercase tracking-wider text-feldgrau hover:text-licorice"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                )}

                {/* ── Category pills ── */}
                <nav className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3">
                    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                        {categories.map((cat) => {
                            const isActive = cat === active;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        setActive(cat);
                                        setQuery("");
                                    }}
                                    className={`shrink-0 inline-flex items-center rounded-full px-4 py-2 text-[12px] font-bold tracking-tight transition-all duration-200 ease-out ${isActive
                                        ? "bg-licorice text-isabelline"
                                        : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice hover:ring-licorice/15"
                                        }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT — editorial title + cards, flows naturally
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-6 pb-[calc(200px+env(safe-area-inset-bottom))]">
                {!searchOpen && (
                    <p className="text-base font-medium text-slate-600 mb-4">
                        Tap any item to read more.
                    </p>
                )}
                {/* Empty state */}
                {loading ? (
                    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-khaki/30 border-t-khaki" />
                        <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                            Loading the menu…
                        </h3>
                        <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                            One moment while we get things ready.
                        </p>
                    </div>
                ) : (
                <>
                {visibleItems.length === 0 && (
                    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(35,20,12,0.04)] ring-1 ring-isabelline">
                        <span className="h-1.5 w-1.5 rounded-full bg-khaki" />
                        <h3 className="mt-4 text-[15px] font-bold tracking-tight text-licorice">
                            Nothing on this list yet
                        </h3>
                        <p className="mt-1.5 text-[12px] leading-[1.5] tracking-tight text-feldgrau">
                            Try a different category or clear your search.
                        </p>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    GRID — square image cards
                  ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                    {gridItems.map((item, idx) => {
                        const fav = isFavorite(item.id);
                        return (
                            <MenuItemCard
                                key={item.id}
                                id={item.id}
                                name={item.name}
                                price={item.price}
                                image={item.image}
                                description={item.description}
                                category={item.category}
                                abv={item.abv}
                                isFavorite={fav}
                                onToggleFavorite={() => toggleFavorite(item.id)}
                                onClick={() => setActiveItemId(item.id)}
                                onAdd={() => addQuick(item)}
                                animationDelayMs={Math.min(idx * 40, 240)}
                            />
                        );
                    })}
                </div>
                </>
            )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                FLOATING CART SUMMARY
              ═══════════════════════════════════════════════════════════ */}
            {itemCount > 0 && (
                <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent">
                    <button
                        type="button"
                        onClick={onViewCart}
                        className="animate-velvet-rise flex w-full max-w-md md:max-w-2xl items-center justify-between gap-3 rounded-full bg-licorice px-6 py-4 shadow-[0_20px_50px_rgba(35,20,12,0.25)] ring-1 ring-licorice/80 transition-all duration-200 ease-out hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki"
                        aria-label={`View cart — ${itemCount} items, ${formatGHSString(subtotal)}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline/15 text-[14px] font-bold text-isabelline ring-1 ring-isabelline/20">
                                {itemCount}
                            </span>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                    Your tab
                                </span>
                                <span className="text-[15px] font-bold tracking-tight text-isabelline">
                                    {formatGHS(subtotal)}
                                </span>
                            </div>
                        </div>
                        <span className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-isabelline group-hover:translate-x-0.5 transition-transform duration-200">
                            View Cart
                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                    </button>
                </div>
            )}

            {/* ── Item Details Bottom Sheet ── */}
            <ItemDetailsSheet item={activeItem} onClose={() => setActiveItemId(null)} />
        </main>
    );
}
