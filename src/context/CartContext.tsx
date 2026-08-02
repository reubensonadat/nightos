import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { MENU, type MenuItem, type ModifierOption } from "../data/menu";

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
    addQuick: (itemId: string) => void;
    addCustom: (
        itemId: string,
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

export function CartProvider({ children }: { children: ReactNode }) {
    const [lines, setLines] = useState<CartLine[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());

    const value = useMemo<CartContextValue>(() => {
        const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
        const subtotal = lines.reduce((sum, l) => sum + l.qty * lineUnitPrice(l), 0);

        return {
            lines,
            itemCount,
            subtotal,
            favorites,
            addQuick: (itemId: string) => {
                const item = MENU.find((m) => m.id === itemId);
                if (!item) return;
                const lineId = makeLineId(itemId, [], "");
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
                itemId: string,
                modifiers: SelectedModifier[],
                notes: string,
                qty: number
            ) => {
                const item = MENU.find((m) => m.id === itemId);
                if (!item) return;
                const lineId = makeLineId(itemId, modifiers, notes);
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
