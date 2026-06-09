import { useState } from "react";
import {
    CheckIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { MENU, formatGHS, type MenuItem, type MenuCategory } from "../../data/menu";

/* ────────────────────────── Extended item type with inventory ────────────────────────── */

type ManagedItem = MenuItem & {
    available: boolean;
    stock: number;
    reorderThreshold: number;
};

/* Seed managed items from the existing MENU */
const INITIAL_ITEMS: ManagedItem[] = MENU.slice(0, 12).map((item, idx) => ({
    ...item,
    available: idx !== 5, // one disabled for demo
    stock: [42, 8, 15, 23, 4, 0, 18, 31, 12, 7, 25, 9][idx] ?? 20,
    reorderThreshold: 10,
}));

const CATEGORIES: MenuCategory[] = ["Signatures", "Spirits", "Wines", "Small Plates"];

/* ────────────────────────── Component ────────────────────────── */

export function MenuManagerScreen() {
    const [items, setItems] = useState<ManagedItem[]>(INITIAL_ITEMS);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<MenuCategory | "All">("All");
    const [editing, setEditing] = useState<ManagedItem | null>(null);
    const [creating, setCreating] = useState(false);

    /* ── Filtering ── */
    const filtered = items.filter((item) => {
        if (activeCategory !== "All" && item.category !== activeCategory) return false;
        if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    /* ── Mutations ── */
    const toggleAvailable = (id: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, available: !item.available } : item)));
    };

    const saveItem = (updated: ManagedItem) => {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditing(null);
    };

    const deleteItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setEditing(null);
    };

    const addItem = (newItem: ManagedItem) => {
        setItems((prev) => [newItem, ...prev]);
        setCreating(false);
    };

    /* ── Stats ── */
    const totalItems = items.length;
    const availableItems = items.filter((i) => i.available).length;
    const lowStock = items.filter((i) => i.stock <= i.reorderThreshold).length;
    const outOfStock = items.filter((i) => i.stock === 0).length;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Items</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalItems}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Available</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{availableItems}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Low Stock</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{lowStock}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Out of Stock</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-dark-red">{outOfStock}</p>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                {/* Search */}
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search items…"
                        className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
                    />
                </div>

                {/* Category filter */}
                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    {(["All", ...CATEGORIES] as const).map((cat) => {
                        const isActive = cat === activeCategory;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all ${isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice"}`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>

                {/* Add button */}
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95"
                >
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add Item
                </button>
            </div>

            {/* ── Items table ── */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                {/* Desktop table */}
                <table className="hidden md:table w-full">
                    <thead className="border-b border-isabelline bg-isabelline/50">
                        <tr className="text-left">
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Item</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Category</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Price</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Stock</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Status</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline">
                        {filtered.map((item) => (
                            <tr key={item.id} className="hover:bg-isabelline/30 transition-colors">
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-isabelline">
                                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                            <p className="truncate text-[10px] tracking-tight text-feldgrau">{item.description}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className="rounded-full bg-isabelline px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">{item.category}</span>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{formatGHS(item.price)}</td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-mono text-[12px] font-bold tabular-nums ${item.stock === 0 ? "text-dark-red" : item.stock <= item.reorderThreshold ? "text-khaki" : "text-licorice"}`}>
                                            {item.stock}
                                        </span>
                                        {item.stock <= item.reorderThreshold && (
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-dark-red">Low</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleAvailable(item.id)}
                                        aria-label={item.available ? "Mark unavailable" : "Mark available"}
                                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${item.available ? "bg-khaki" : "bg-feldgrau/20"}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.available ? "translate-x-5" : "translate-x-1"}`} />
                                    </button>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(item)}
                                        aria-label="Edit item"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau transition-colors hover:bg-khaki/15 hover:text-licorice"
                                    >
                                        <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-isabelline">
                    {filtered.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-isabelline">
                                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                    <span className="font-mono font-bold tabular-nums text-licorice">{formatGHS(item.price)}</span>
                                    <span className="text-feldgrau">·</span>
                                    <span className={`font-bold tabular-nums ${item.stock === 0 ? "text-dark-red" : item.stock <= item.reorderThreshold ? "text-khaki" : "text-feldgrau"}`}>
                                        Stock: {item.stock}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleAvailable(item.id)}
                                aria-label={item.available ? "Mark unavailable" : "Mark available"}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${item.available ? "bg-khaki" : "bg-feldgrau/20"}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.available ? "translate-x-5" : "translate-x-1"}`} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditing(item)}
                                aria-label="Edit item"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-isabelline text-feldgrau"
                            >
                                <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                        <p className="mt-3 text-[12px] font-bold tracking-tight text-licorice">No items match your filters</p>
                    </div>
                )}
            </div>

            {/* ── Edit Modal ── */}
            {(editing || creating) && (
                <EditItemModal
                    item={editing}
                    onSave={editing ? saveItem : addItem}
                    onClose={() => {
                        setEditing(null);
                        setCreating(false);
                    }}
                    onDelete={editing ? () => deleteItem(editing.id) : undefined}
                />
            )}
        </div>
    );
}

/* ────────────────────────── Edit Modal ────────────────────────── */

type ModalProps = {
    item: ManagedItem | null;
    onSave: (item: ManagedItem) => void;
    onClose: () => void;
    onDelete?: () => void;
};

function EditItemModal({ item, onSave, onClose, onDelete }: ModalProps) {
    const [draft, setDraft] = useState<ManagedItem>(
        item ?? {
            ...MENU[0],
            id: `new-${Date.now()}`,
            name: "",
            description: "",
            price: 0,
            category: "Signatures",
            image: MENU[0].image,
            available: true,
            stock: 20,
            reorderThreshold: 10,
        }
    );

    const handleSave = () => {
        if (!draft.name.trim()) return;
        onSave(draft);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between border-b border-isabelline bg-white px-5 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">{item ? "Edit Item" : "New Item"}</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">{item ? item.name : "Create menu item"}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"
                    >
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Name</label>
                        <input
                            type="text"
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            placeholder="Velvet Old Fashioned"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Description</label>
                        <textarea
                            value={draft.description}
                            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            placeholder="A short, evocative description"
                            rows={2}
                            className="mt-1 w-full resize-none rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Price (GHS)</label>
                            <input
                                type="number"
                                value={draft.price}
                                onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Category</label>
                            <select
                                value={draft.category}
                                onChange={(e) => setDraft({ ...draft, category: e.target.value as MenuCategory })}
                                className="mt-1 w-full appearance-none rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Stock</label>
                            <input
                                type="number"
                                value={draft.stock}
                                onChange={(e) => setDraft({ ...draft, stock: parseInt(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Reorder At</label>
                            <input
                                type="number"
                                value={draft.reorderThreshold}
                                onChange={(e) => setDraft({ ...draft, reorderThreshold: parseInt(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                            />
                        </div>
                    </div>

                    {/* Available toggle */}
                    <button
                        type="button"
                        onClick={() => setDraft({ ...draft, available: !draft.available })}
                        className="flex w-full items-center justify-between rounded-lg bg-isabelline px-3 py-2.5 ring-1 ring-licorice/8"
                    >
                        <span className="text-[11px] font-bold tracking-tight text-licorice">Available on menu</span>
                        <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${draft.available ? "bg-khaki" : "bg-feldgrau/20"}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${draft.available ? "translate-x-5" : "translate-x-1"}`} />
                        </span>
                    </button>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-isabelline bg-white px-5 py-3">
                    {onDelete ? (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="inline-flex items-center gap-1 rounded-full bg-dark-red/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-dark-red transition-colors hover:bg-dark-red/20"
                        >
                            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            Delete
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!draft.name.trim()}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40"
                        >
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
