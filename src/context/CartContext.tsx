import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MenuItem, ModifierOption } from "../data/menu";

const CART_STORAGE_KEY = "nightos:cart";
const FAVORITES_STORAGE_KEY = "nightos:favorites";

export type SelectedModifier = {
    groupId: string;
    option: ModifierOption;
};

export type CartLine = {
    /** Stable line ID — combines item + selected modifiers + notes so the same
     *  configuration merges, but a different configuration creates a new line. */
    lineId: string;
    item: MenuItem;
    qty: number;
    modifiers: SelectedModifier[];
    notes?: string;
};

type CartContextValue = {
    lines: CartLine[];
    itemCount: number;
    subtotal: number;
    favorites: Set<string>;
    addQuick: (item: MenuItem) => void;
    addCustom: (
        item: MenuItem,
        modifiers: SelectedModifier[],
        notes: string,
        qty: number
    ) => void;
    remove: (lineId: string) => void;
    setQty: (lineId: string, qty: number) => void;
    clear: () => void;
    toggleFavorite: (itemId: string) => void;
    isFavorite: (itemId: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function makeLineId(itemId: string, modifiers: SelectedModifier[], notes: string) {
    const modKey = modifiers
        .map((m) => `${m.groupId}:${m.option.id}`)
        .sort()
        .join("|");
    return `${itemId}__${modKey}__${notes.trim()}`;
}

function lineUnitPrice(line: CartLine): number {
    const delta = line.modifiers.reduce(
        (sum, m) => sum + (m.option.priceDelta ?? 0),
        0
    );
    return line.item.price + delta;
}

function loadLines(): CartLine[] {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return [];
        // Lines carry their full item snapshot (prices, name, image) so the
        // cart survives refresh without re-fetching the menu from the DB.
        const parsed: CartLine[] = JSON.parse(raw);
        return parsed.filter(
            (line) => line && line.item && typeof line.item.id === 'string' && line.qty > 0,
        );
    } catch {
        return [];
    }
}

function loadFavorites(): Set<string> {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [lines, setLines] = useState<CartLine[]>(loadLines);
    const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

    // Cart stays in localStorage — no DB calls while browsing/adding.
    // The DB is only touched when the order is sent to the kitchen.
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
        } catch {}
    }, [lines]);

    useEffect(() => {
        try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
        } catch {}
    }, [favorites]);

    const value = useMemo<CartContextValue>(() => {
        const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
        const subtotal = lines.reduce((sum, l) => sum + l.qty * lineUnitPrice(l), 0);

        return {
            lines,
            itemCount,
            subtotal,
            favorites,
            addQuick: (item: MenuItem) => {
                const lineId = makeLineId(item.id, [], "");
                setLines((prev) => {
                    const existing = prev.find((l) => l.lineId === lineId);
                    if (existing) {
                        return prev.map((l) =>
                            l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l
                        );
                    }
                    return [...prev, { lineId, item, qty: 1, modifiers: [], notes: "" }];
                });
            },
            addCustom: (
                item: MenuItem,
                modifiers: SelectedModifier[],
                notes: string,
                qty: number
            ) => {
                const lineId = makeLineId(item.id, modifiers, notes);
                setLines((prev) => {
                    const existing = prev.find((l) => l.lineId === lineId);
                    if (existing) {
                        return prev.map((l) =>
                            l.lineId === lineId ? { ...l, qty: l.qty + qty } : l
                        );
                    }
                    return [
                        ...prev,
                        { lineId, item, qty, modifiers, notes: notes.trim() || undefined },
                    ];
                });
            },
            remove: (lineId: string) => {
                setLines((prev) => prev.filter((l) => l.lineId !== lineId));
            },
            setQty: (lineId: string, qty: number) => {
                if (qty <= 0) {
                    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
                    return;
                }
                setLines((prev) =>
                    prev.map((l) => (l.lineId === lineId ? { ...l, qty } : l))
                );
            },
            clear: () => setLines([]),
            toggleFavorite: (itemId: string) => {
                setFavorites((prev) => {
                    const next = new Set(prev);
                    if (next.has(itemId)) next.delete(itemId);
                    else next.add(itemId);
                    return next;
                });
            },
            isFavorite: (itemId: string) => favorites.has(itemId),
        };
    }, [lines, favorites]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within a CartProvider");
    return ctx;
}

/** Helper for consumers — computes per-line unit price including modifier deltas. */
export function getLineUnitPrice(line: CartLine): number {
    return lineUnitPrice(line);
}
