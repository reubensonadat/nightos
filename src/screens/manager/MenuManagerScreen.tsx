import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db, type DbInventoryItem } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useVenue } from "../../hooks/useVenue";
import clsx from "clsx";

type InventoryRow = DbInventoryItem & {
    sellingPrice: number;
};

export function MenuManagerScreen() {
    const { venue } = useVenue("velvet-lounge");
    const [items, setItems] = useState<InventoryRow[]>([]);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [editing, setEditing] = useState<InventoryRow | null>(null);
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const init = async () => {
            await fetchData();
        };
        init();
        }, [fetchData]);

    const categories = useMemo(
        () => ["All", ...new Set(items.map((i) => i.category).filter(Boolean))],
        [items],
    );

    const filtered = items.filter((item) => {
        if (activeCategory !== "All" && item.category !== activeCategory) return false;
        if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const toggleActive = async (item: InventoryRow) => {
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

    const restockItem = async (item: InventoryRow) => {
        if (!venue.id || venue.id === "00000000-0000-0000-0000-000000000000") return;
        const newStock = Number(item.stock_qty) + 10;
        const { error } = await supabaseUpdateInventory(venue.id, item.id, { stock_qty: newStock });
        if (error) {
            toast.error("Could not restock.");
            return;
        }
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock_qty: newStock } : i)));
        toast.success(`Restocked ${item.name} +10.`);
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

    const totalItems = items.filter((i) => i.is_active).length;
    const lowStock = items.filter((i) => i.is_active && Number(i.stock_qty) > 0 && Number(i.stock_qty) <= Number(i.reorder_threshold)).length;
    const outOfStock = items.filter((i) => i.is_active && Number(i.stock_qty) === 0).length;
    const totalInventoryValue = items.reduce((s, i) => s + Number(i.unit_cost) * Number(i.stock_qty), 0);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="grid grid-cols-2 gap-3 md:flex md:flex-row md:overflow-x-auto md:no-scrollbar md:gap-4">
                <div className="col-span-2 md:shrink-0 md:min-w-[320px] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Inv. Value</p>
                    <p className="text-4xl font-bold tabular-nums text-licorice">{formatGHS(totalInventoryValue)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Total Items</p>
                    <p className="text-4xl font-bold tabular-nums text-licorice">{totalItems}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Available</p>
                    <p className="text-4xl font-bold tabular-nums text-khaki">{items.filter((i) => i.is_active).length}</p>
                </div>
                <div className="rounded-2xl bg-licorice p-4 text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.15)] flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-isabelline/60">Low Stock</p>
                    <p className="text-4xl font-bold tabular-nums text-khaki">{lowStock}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline flex flex-col gap-1 md:shrink-0 md:min-w-[180px] md:flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-feldgrau">Out of Stock</p>
                    <p className="text-4xl font-bold tabular-nums text-dark-red">{outOfStock}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-isabelline px-3.5 py-2 ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-feldgrau" strokeWidth={2} />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory items…" className="min-w-0 flex-1 bg-transparent text-[12px] text-licorice placeholder:text-feldgrau/50 focus:outline-none" />
                </div>
                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-isabelline p-1">
                    {categories.map((cat) => {
                        const isActive = cat === activeCategory;
                        return (
                            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                                className={clsx("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all", isActive ? "bg-licorice text-isabelline shadow-sm" : "text-feldgrau hover:text-licorice")}>
                                {cat}
                            </button>
                        );
                    })}
                </div>
                <button type="button" onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-licorice px-3.5 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-95">
                    <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Add Item
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                    <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">Loading inventory…</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-isabelline">
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
                            {filtered.map((item) => {
                                const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - Number(item.unit_cost)) / item.sellingPrice) * 100 : 0;
                                const stock = Number(item.stock_qty);
                                const isLow = stock > 0 && stock <= Number(item.reorder_threshold);
                                return (
                                    <tr key={item.id} className={clsx("hover:bg-isabelline/30 transition-colors", !item.is_active && "opacity-50")}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className={clsx("h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-[12px]",
                                                    item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                                    item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700")}>
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
                                                <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                                                    marginPct > 50 ? "bg-emerald-100 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red")}>
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
                                            <button type="button" onClick={() => toggleActive(item)}
                                                className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.is_active ? "bg-khaki" : "bg-feldgrau/20")}>
                                                <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.is_active ? "translate-x-5" : "translate-x-1")} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => restockItem(item)} title="Restock +10"
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
                            const marginPct = item.sellingPrice > 0 ? ((item.sellingPrice - Number(item.unit_cost)) / item.sellingPrice) * 100 : 0;
                            const stock = Number(item.stock_qty);
                            const isLow = stock > 0 && stock <= Number(item.reorder_threshold);
                            return (
                                <div key={item.id} className={clsx("flex items-center gap-3 px-4 py-3", !item.is_active && "opacity-50")}>
                                    <div className={clsx("h-12 w-12 shrink-0 rounded-lg flex items-center justify-center font-bold text-[14px]",
                                        item.category === "Spirits" ? "bg-amber-100 text-amber-700" :
                                        item.category === "Wines" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700")}>
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
                                    <button type="button" onClick={() => toggleActive(item)}
                                        className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", item.is_active ? "bg-khaki" : "bg-feldgrau/20")}>
                                        <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", item.is_active ? "translate-x-5" : "translate-x-1")} />
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
            )}

            {(editing || creating) && (
                <ItemModal item={editing} onSave={editing ? saveItem : addItem}
                    onClose={() => { setEditing(null); setCreating(false); }}
                    onDelete={editing ? () => deleteItem(editing.id) : undefined} />
            )}
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
    const [draft, setDraft] = useState<InventoryRow>(item ?? {
        // eslint-disable-next-line react-hooks/purity
        id: `inv-${Date.now()}`,
        venue_id: "",
        product_id: null,
        name: "",
        category: "general",
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
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-isabelline bg-white px-5 py-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-feldgrau">{item ? "Edit Item" : "New Item"}</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">{item ? item.name : "Add inventory item"}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice"><XMarkIcon className="h-4 w-4" strokeWidth={2.25} /></button>
                </div>
                <div className="space-y-3 px-5 py-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Item Name</label>
                        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cocoa Espresso Liqueur"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Category</label>
                            <input type="text" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Spirits"
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Unit</label>
                            <input type="text" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="bottle / kg / pieces"
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Unit Cost (GHS)</label>
                            <input type="number" value={Number(draft.unit_cost)} onChange={(e) => setDraft({ ...draft, unit_cost: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Sell Price (menu)</label>
                            <input type="number" value={draft.sellingPrice} disabled
                                className="mt-1 w-full rounded-lg bg-isabelline/50 px-3 py-2 font-mono text-[12px] tabular-nums text-feldgrau ring-1 ring-licorice/8" />
                        </div>
                    </div>
                    {draft.sellingPrice > 0 && (
                        <div className={clsx("rounded-lg px-3 py-2 text-xs font-bold", marginPct > 50 ? "bg-emerald-50 text-emerald-700" : marginPct > 30 ? "bg-khaki/15 text-khaki" : "bg-dark-red/10 text-dark-red")}>
                            Margin: {marginPct.toFixed(0)}% · Profit: {formatGHS(draft.sellingPrice - Number(draft.unit_cost))}/unit
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Stock</label>
                            <input type="number" value={Number(draft.stock_qty)} onChange={(e) => setDraft({ ...draft, stock_qty: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-feldgrau">Reorder At</label>
                            <input type="number" value={Number(draft.reorder_threshold)} onChange={(e) => setDraft({ ...draft, reorder_threshold: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 font-mono text-[12px] tabular-nums text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-feldgrau">Supplier</label>
                        <input type="text" value={draft.supplier ?? ""} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} placeholder="e.g. Premium Wines GH"
                            className="mt-1 w-full rounded-lg bg-isabelline px-3 py-2 text-[12px] text-licorice placeholder:text-feldgrau/50 ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20" />
                    </div>
                </div>
                <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-isabelline bg-white px-5 py-3">
                    {onDelete ? (
                        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-full bg-dark-red/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-dark-red transition-colors hover:bg-dark-red/20">
                            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} /> Delete
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="rounded-full bg-isabelline px-4 py-2 text-xs font-bold tracking-tight text-feldgrau ring-1 ring-licorice/8">Cancel</button>
                        <button type="button" onClick={() => { if (draft.name.trim()) onSave(draft); }} disabled={!draft.name.trim()}
                            className="inline-flex items-center gap-1 rounded-full bg-licorice px-4 py-2 text-xs font-bold tracking-tight text-isabelline shadow-sm disabled:opacity-40">
                            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} /> Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
