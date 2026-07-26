import { useState } from "react";
import {
    CheckIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import { INVENTORY, type InventoryItem } from "../../data/managerData";
import clsx from "clsx";

const CATEGORIES = ["All", "Spirits", "Wines", "Food"] as const;

export function MenuManagerScreen() {
    const [items, setItems] = useState<InventoryItem[]>(INVENTORY);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [editing, setEditing] = useState<InventoryItem | null>(null);
    const [creating, setCreating] = useState(false);

    const filtered = items.filter((item) => {
        if (activeCategory !== "All" && item.category !== activeCategory) return false;
        if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const toggleAvailable = (id: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, available: !item.available } : item)));
    };

    const restockItem = (id: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, stock: item.stock + 10, lastRestocked: "Just now" } : item)));
    };

    const saveItem = (updated: InventoryItem) => {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditing(null);
    };

    const deleteItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setEditing(null);
    };

    const addItem = (newItem: InventoryItem) => {
        setItems((prev) => [newItem, ...prev]);
        setCreating(false);
    };

    const totalItems = items.length;
    const lowStock = items.filter((i) => i.stock > 0 && i.stock <= i.reorderThreshold).length;
    const outOfStock = items.filter((i) => i.stock === 0).length;
    const totalInventoryValue = items.reduce((s, i) => s + i.unitCost * i.stock, 0);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Total Items</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-licorice">{totalItems}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Available</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{items.filter(i => i.available).length}</p>
                </div>
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">Low Stock</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-khaki">{lowStock}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Out of Stock</p>
                    <p className="mt-1 font-mono text-[22px] font-black tabular-nums text-dark-red">{outOfStock}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Inv. Value</p>
                    <p className="mt-1 font-mono text-[18px] font-black tabular-nums text-licorice">{formatGHS(totalInventoryValue)}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory items…" className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none" />
                </div>
                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    {CATEGORIES.map((cat) => {
                        const isActive = cat === activeCategory;
                        return (
                            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                                className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all", isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice")}>
                                {cat}
                            </button>
                        );
                    })}
                </div>
                <button type="button" onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95">
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Add Item
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
                <table className="hidden md:table w-full">
                    <thead className="border-b border-isabelline bg-isabelline/50">
                        <tr className="text-left">
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Item</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Cat.</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Cost</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Sell</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Margin</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Stock</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">Status</th>
                            <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-isabelline">
                        {filtered.map((item) => {
                            const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - item.unitCost) / item.sellingPrice) * 100 : 0;
                            const isLow = item.stock > 0 && item.stock <= item.reorderThreshold;
                            return (
                                <tr key={item.id} className="hover:bg-isabelline/30 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className={clsx("h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-[12px]",
                                                item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                                item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700")}>
                                                {item.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                                <p className="truncate text-[10px] tracking-tight text-feldgrau">{item.supplier || "No supplier"} · {item.lastRestocked}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="rounded-full bg-isabelline px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-feldgrau">{item.category}</span>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-feldgrau">{formatGHS(item.unitCost)}</td>
                                    <td className="px-4 py-2.5 font-mono text-[12px] font-bold tabular-nums text-licorice">{item.sellingPrice > 0 ? formatGHS(item.sellingPrice) : <span className="text-feldgrau/50">—</span>}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                            marginPct > 50 ? "bg-emerald-100 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red")}>
                                            {marginPct.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className={clsx("font-mono text-[12px] font-bold tabular-nums", item.stock === 0 ? "text-dark-red" : isLow ? "text-amber-600" : "text-licorice")}>{item.stock}</span>
                                            {isLow && <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" strokeWidth={2} />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button type="button" onClick={() => toggleAvailable(item.id)}
                                            className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.available ? "bg-khaki" : "bg-feldgrau/20")}>
                                            <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.available ? "translate-x-5" : "translate-x-1")} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button type="button" onClick={() => restockItem(item.id)} title="Restock +10"
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau transition-colors hover:bg-emerald-100 hover:text-emerald-600">
                                                <PlusIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                            </button>
                                            <button type="button" onClick={() => setEditing(item)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-isabelline text-feldgrau transition-colors hover:bg-khaki/15 hover:text-licorice">
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
                    {filtered.map((item) => {
                        const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - item.unitCost) / item.sellingPrice) * 100 : 0;
                        const isLow = item.stock > 0 && item.stock <= item.reorderThreshold;
                        return (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                                <div className={clsx("h-12 w-12 shrink-0 rounded-lg flex items-center justify-center font-bold text-[14px]",
                                    item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                    item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700")}>
                                    {item.name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-bold tracking-tight text-licorice">{item.name}</p>
                                    <div className="mt-0.5 flex items-center gap-2 text-[10px] flex-wrap">
                                        <span className="font-mono font-bold text-licorice">{formatGHS(item.sellingPrice)}</span>
                                        <span className="text-feldgrau">·</span>
                                        <span className={clsx("font-bold", item.stock === 0 ? "text-dark-red" : isLow ? "text-amber-600" : "text-feldgrau")}>Stock: {item.stock}</span>
                                        <span className="text-feldgrau">·</span>
                                        <span className={clsx("font-bold", marginPct > 50 ? "text-emerald-600" : marginPct > 30 ? "text-khaki" : "text-dark-red")}>{marginPct.toFixed(0)}% margin</span>
                                    </div>
                                </div>
                                <button type="button" onClick={() => toggleAvailable(item.id)}
                                    className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.available ? "bg-khaki" : "bg-feldgrau/20")}>
                                    <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.available ? "translate-x-5" : "translate-x-1")} />
                                </button>
                                <button type="button" onClick={() => setEditing(item)}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-isabelline text-feldgrau">
                                    <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                </button>
                            </div>
                        );
                    })}
                </div>
                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-licorice/20" />
                        <p className="mt-3 text-[12px] font-bold tracking-tight text-licorice">No items match your filters</p>
                    </div>
                )}
            </div>

            {(editing || creating) && (
                <ItemModal item={editing} onSave={editing ? saveItem : addItem}
                    onClose={() => { setEditing(null); setCreating(false); }}
                    onDelete={editing ? () => deleteItem(editing.id) : undefined} />
            )}
        </div>
    );
}

function ItemModal({ item, onSave, onClose, onDelete }: { item: InventoryItem | null; onSave: (item: InventoryItem) => void; onClose: () => void; onDelete?: () => void }) {
    const [draft, setDraft] = useState<InventoryItem>(() => item ?? {
        id: `inv-${Date.now()}`, name: "", category: "Spirits", stock: 10, reorderThreshold: 5, unitCost: 0, sellingPrice: 0, available: true, lastRestocked: "Today",
    });
    const marginPct = draft.sellingPrice > 0 ? ((draft.sellingPrice - draft.unitCost) / draft.sellingPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4">
            <div className="absolute inset-0 bg-licorice/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-isabelline bg-white px-5 py-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">{item ? "Edit Item" : "New Item"}</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">{item ? item.name : "Add inventory item"}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"><XMarkIcon className="h-4 w-4" strokeWidth={2.25} /></button>
                </div>
                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Item Name</label>
                        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cocoa Espresso Liqueur"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Category</label>
                        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                            className="mt-1 w-full appearance-none rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20">
                            {CATEGORIES.filter(c => c !== "All").map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Unit Cost (GHS)</label>
                            <input type="number" value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Sell Price</label>
                            <input type="number" value={draft.sellingPrice} onChange={(e) => setDraft({ ...draft, sellingPrice: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    {draft.sellingPrice > 0 && (
                        <div className={clsx("rounded-lg px-3 py-2 text-[11px] font-bold", marginPct > 50 ? "bg-emerald-50 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red")}>
                            Margin: {marginPct.toFixed(0)}% · Profit: {formatGHS(draft.sellingPrice - draft.unitCost)}/unit
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Stock</label>
                            <input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: parseInt(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Reorder At</label>
                            <input type="number" value={draft.reorderThreshold} onChange={(e) => setDraft({ ...draft, reorderThreshold: parseInt(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    <button type="button" onClick={() => setDraft({ ...draft, available: !draft.available })}
                        className="flex w-full items-center justify-between rounded-lg bg-isabelline px-3 py-2.5 ring-1 ring-licorice/8">
                        <span className="text-[11px] font-bold tracking-tight text-licorice">Available on menu</span>
                        <span className={clsx("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", draft.available ? "bg-khaki" : "bg-feldgrau/20")}>
                            <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", draft.available ? "translate-x-5" : "translate-x-1")} />
                        </span>
                    </button>
                </div>
                <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-isabelline bg-white px-5 py-3">
                    {onDelete ? (
                        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-full bg-dark-red/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-dark-red transition-colors hover:bg-dark-red/20">
                            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} /> Delete
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-[11px] font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">Cancel</button>
                        <button type="button" onClick={() => { if (draft.name.trim()) onSave(draft); }} disabled={!draft.name.trim()}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-[11px] font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40">
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}