import { create } from "zustand";
import { MENU, type MenuItem, type ModifierOption } from "../data/menu";
import type { OrderSummary } from "../screens/OrderTrackingScreen";

export type SelectedModifier = {
    groupId: string;
    option: ModifierOption;
};

export type CartLine = {
    lineId: string;
    item: MenuItem;
    qty: number;
    modifiers: SelectedModifier[];
    notes?: string;
};

type TabState = {
    lines: CartLine[];
    favorites: Set<string>;
    activeOrder: OrderSummary | null;
    
    // Actions
    addQuick: (itemId: string) => void;
    addCustom: (itemId: string, modifiers: SelectedModifier[], notes: string, qty: number) => void;
    remove: (lineId: string) => void;
    setQty: (lineId: string, qty: number) => void;
    clearCart: () => void;
    toggleFavorite: (itemId: string) => void;
    setActiveOrder: (order: OrderSummary | null) => void;
};

function makeLineId(itemId: string, modifiers: SelectedModifier[], notes: string) {
    const modKey = modifiers
        .map((m) => `${m.groupId}:${m.option.id}`)
        .sort()
        .join("|");
    return `${itemId}__${modKey}__${notes.trim()}`;
}

export function getLineUnitPrice(line: CartLine): number {
    const delta = line.modifiers.reduce(
        (sum, m) => sum + (m.option.priceDelta ?? 0),
        0
    );
    return line.item.price + delta;
}

export const useTabStore = create<TabState>((set) => ({
    lines: [],
    favorites: new Set(),
    activeOrder: null,

    addQuick: (itemId: string) => {
        const item = MENU.find((m) => m.id === itemId);
        if (!item) return;
        const lineId = makeLineId(itemId, [], "");
        set((state) => {
            const existing = state.lines.find((l) => l.lineId === lineId);
            if (existing) {
                return {
                    lines: state.lines.map((l) =>
                        l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l
                    ),
                };
            }
            return { lines: [...state.lines, { lineId, item, qty: 1, modifiers: [], notes: "" }] };
        });
    },

    addCustom: (itemId: string, modifiers: SelectedModifier[], notes: string, qty: number) => {
        const item = MENU.find((m) => m.id === itemId);
        if (!item) return;
        const lineId = makeLineId(itemId, modifiers, notes);
        set((state) => {
            const existing = state.lines.find((l) => l.lineId === lineId);
            if (existing) {
                return {
                    lines: state.lines.map((l) =>
                        l.lineId === lineId ? { ...l, qty: l.qty + qty } : l
                    ),
                };
            }
            return {
                lines: [...state.lines, { lineId, item, qty, modifiers, notes: notes.trim() || undefined }],
            };
        });
    },

    remove: (lineId: string) => {
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) }));
    },

    setQty: (lineId: string, qty: number) => {
        if (qty <= 0) {
            set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) }));
            return;
        }
        set((state) => ({
            lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)),
        }));
    },

    clearCart: () => set({ lines: [] }),

    toggleFavorite: (itemId: string) => {
        set((state) => {
            const next = new Set(state.favorites);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return { favorites: next };
        });
    },

    setActiveOrder: (order: OrderSummary | null) => set({ activeOrder: order }),
}));

export const useTabComputed = () => {
    const { lines, activeOrder, favorites } = useTabStore();
    
    const cartItemCount = lines.reduce((sum, l) => sum + l.qty, 0);
    const cartSubtotal = lines.reduce((sum, l) => sum + l.qty * getLineUnitPrice(l), 0);
    
    const orderItemCount = activeOrder ? activeOrder.itemCount : 0;
    const orderTotal = activeOrder ? activeOrder.total : 0;

    const totalItems = cartItemCount + orderItemCount;
    const tabSubtotal = cartSubtotal + orderTotal;

    return {
        cartItemCount,
        cartSubtotal,
        orderItemCount,
        orderTotal,
        totalItems,
        tabSubtotal,
        isFavorite: (itemId: string) => favorites.has(itemId),
    };
};
