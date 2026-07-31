import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeftIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    PlusIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import {
    CATEGORIES,
    MENU,
    formatGHS,
    type MenuCategory,
    type MenuItem,
} from "../data/menu";
import { useTabStore, useTabComputed } from "../store/useTabStore";
import { ItemDetailsSheet } from "../components/ItemDetailsSheet";
import { db } from "../lib/api";
import type { DbProduct } from "../lib/api";

type Props = {
    venueId?: string;
    onBack?: () => void;
};

async function fetchProducts(venueId: string): Promise<MenuItem[]> {
    const { data, error } = await db.products(venueId);
    if (error || !data) return [];
    return data.map((p: DbProduct) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        longDescription: p.long_description || undefined,
        price: p.price,
        category: mapCategory(p.category_id),
        image: p.images?.[0] || '',
        tags: p.tags?.filter((t): t is NonNullable<MenuItem['tags']>[number] =>
            ['Popular', 'New', "Chef's Pick", 'Vegetarian'].includes(t as any)
        ) || undefined,
        abv: p.abv || undefined,
        origin: p.origin || undefined,
    }));
}

function mapCategory(_categoryId: string | null): MenuCategory {
    return "Signatures";
}

export function MenuScreen({ venueId, onBack }: Props) {
    const [active, setActive] = useState<MenuCategory>("Signatures");
    const [query, setQuery] = useState("");
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const { addQuick, toggleFavorite } = useTabStore();
    const { isFavorite } = useTabComputed();
    const [supabaseItems, setSupabaseItems] = useState<MenuItem[] | null>(null);

    const session = useMemo(() => {
        try {
            const sessionStr = localStorage.getItem("nightos:session");
            return sessionStr ? JSON.parse(sessionStr) : null;
        } catch {
            return null;
        }
    }, []);

    const tableLabel = session?.tableLabel || "Table 04";

    useEffect(() => {
        if (!venueId) return;
        fetchProducts(venueId).then(items => {
            if (items.length > 0) setSupabaseItems(items);
        });
    }, [venueId]);

    const items = supabaseItems ?? MENU;
    const categories: MenuCategory[] = supabaseItems
        ? [...new Set(supabaseItems.map(i => i.category))]
        : CATEGORIES;

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

    // Featured item — only shown on Signatures, no search
    const featuredItem = items.find((m) => m.id === "sig-hibiscus-spritz");
    const showFeatured = active === "Signatures" && !query && featuredItem;
    const gridItems = showFeatured
        ? visibleItems.filter((i) => i.id !== featuredItem!.id)
        : visibleItems;

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER — clean, like a printed menu
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                {/* ── Top Bar ── */}
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3 relative">
                    <div className="flex items-center">
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
                    </div>

                    <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] bottom-3 flex items-center justify-center pointer-events-none">
                        <span className="text-[18px] font-bold tracking-tight text-licorice pointer-events-auto">
                            Menu
                        </span>
                    </div>

                    <div className="flex items-center">
                        <button
                            type="button"
                            className="
                                rounded-full border border-licorice/20 bg-transparent
                                px-3 py-1.5
                                text-[11px] font-bold uppercase tracking-wider text-licorice
                                transition-all
                                hover:border-licorice/40 hover:bg-licorice/5
                                active:scale-95
                            "
                        >
                            {tableLabel}
                        </button>
                    </div>
                </div>

                {/* Search input */}
                <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pb-3 animate-velvet-fade">
                    <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-licorice/8">
                        <MagnifyingGlassIcon
                            className="h-4 w-4 text-feldgrau"
                            strokeWidth={2.25}
                        />
                        <input
                            autoFocus
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
                                        ? "bg-licorice text-isabelline shadow-[0_4px_14px_rgba(35,20,12,0.25)]"
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
            <section className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
                {/* ── Editorial Title Section ── */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                        {query ? "Searching" : "Chapter"}
                    </p>
                    <h1 className="mt-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.04em] text-licorice">
                        {query ? `"${query}"` : active}
                    </h1>
                    {!query && (
                        <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.55] tracking-tight text-feldgrau">
                            Curated by Chef Ama — tap any dish to read more.
                        </p>
                    )}
                </div>


                {/* Empty state */}
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
                            <article
                                key={item.id}
                                className="animate-velvet-rise group relative flex flex-col"
                                style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                            >
                                {/* ── Image Section (Completely separate from text) ── */}
                                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-[24px] bg-black/5 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setActiveItemId(item.id)}
                                        aria-label={`View details for ${item.name}`}
                                        className="absolute inset-0 z-10 block"
                                    />
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                    />

                                    {/* Top-right Heart Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(item.id);
                                        }}
                                        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                                        aria-pressed={fav}
                                        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-md transition-transform active:scale-90"
                                    >
                                        {fav ? (
                                            <HeartIconSolid className="h-4 w-4 text-dark-red" />
                                        ) : (
                                            <HeartIcon className="h-4 w-4 text-licorice" strokeWidth={2.5} />
                                        )}
                                    </button>
                                </div>

                                {/* ── Information Section (No white background) ── */}
                                <div className="mt-3 flex flex-col px-1">
                                    {/* Row 1: Price and Plus Button */}
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-[16px] font-bold text-licorice">
                                            {formatGHS(item.price)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addQuick(item);
                                            }}
                                            aria-label={`Add ${item.name} to cart`}
                                            className="relative z-20 flex h-8 w-8 items-center justify-end text-licorice transition-transform hover:opacity-70 active:scale-90"
                                        >
                                            <PlusIcon className="h-6 w-6" strokeWidth={2.5} />
                                        </button>
                                    </div>

                                    {/* Row 2: Name */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveItemId(item.id)}
                                        className="mt-1 text-left"
                                    >
                                        <h3 className="line-clamp-1 text-[14px] font-bold leading-tight tracking-tight text-licorice">
                                            {item.name}
                                        </h3>
                                    </button>

                                    {/* Row 3: Description (or category/abv if no description) */}
                                    <p className="mt-1 line-clamp-2 text-[11px] leading-[1.4] text-feldgrau">
                                        {item.description || (item.abv ? `ABV ${item.abv} • ${item.category}` : item.category)}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            {/* ── Item Details Bottom Sheet ── */}
            <ItemDetailsSheet item={activeItem} onClose={() => setActiveItemId(null)} />
        </main>
    );
}
