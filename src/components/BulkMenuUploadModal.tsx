import { useState, useRef, useId } from "react";
import {
    ArrowUpTrayIcon,
    DocumentArrowDownIcon,
    DocumentTextIcon,
    XMarkIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { db, type DbMenuCategory } from "../lib/api";
import { formatGHS } from "../data/menu";

export interface ParsedMenuItem {
    name: string;
    category: string;
    price: number;
    costPrice?: number;
    station: "kitchen" | "bar";
    description?: string;
    status: "valid" | "error";
    errorMsg?: string;
}

interface BulkMenuUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    venueId: string;
    existingCategories: DbMenuCategory[];
    onSuccess: () => void;
}

const TEMPLATE_CSV = `Name,Category,Price,Cost Price,Station,Description
Don Julio 1942,Tequila & Agave,2500,1200,bar,Ultra-premium anejo tequila 700ml
Hennessy VSOP,Cognac,950,450,bar,700ml bottle service with mixers
Crispy Chicken Wings,Starters & Bites,85,32,kitchen,Honey glazed with ranch dip
Prime Ribeye Steak,Mains,280,110,kitchen,400g grilled ribeye with herb butter
Passion Fruit Mojito,Cocktails,95,22,bar,Fresh mint lime white rum and soda
Draft Beer Mug,Beer & Cider,45,15,bar,Cold local craft draft beer on tap`;

export function BulkMenuUploadModal({
    isOpen,
    onClose,
    venueId,
    existingCategories,
    onSuccess,
}: BulkMenuUploadModalProps) {
    const [mode, setMode] = useState<"file" | "paste">("file");
    const [rawText, setRawText] = useState("");
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputId = useId();

    if (!isOpen) return null;

    const handleDownloadTemplate = () => {
        const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "bysen_menu_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Downloaded Excel/CSV template!");
    };

    const parseCsvText = (text: string) => {
        const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            setParsedItems([]);
            return;
        }

        // Determine delimiter: tab (Excel copy/paste) or comma or semicolon
        const firstLine = lines[0];
        let delimiter = ",";
        if (firstLine.includes("\t")) delimiter = "\t";
        else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

        const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
        const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("item") || h.includes("title"));
        const catIdx = headers.findIndex((h) => h.includes("cat") || h.includes("group") || h.includes("section"));
        const priceIdx = headers.findIndex((h) => h.includes("price") || h.includes("amount") || h.includes("cost") && !h.includes("cost price"));
        const costPriceIdx = headers.findIndex((h) => h.includes("cost price") || h.includes("cost_price") || h.includes("unit cost"));
        const stationIdx = headers.findIndex((h) => h.includes("station") || h.includes("type") || h.includes("dept") || h.includes("bar"));
        const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("note") || h.includes("detail"));

        // If no headers match, assume default ordering: Name, Category, Price, Cost, Station, Desc
        const hasHeader = nameIdx !== -1 || priceIdx !== -1;
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const results: ParsedMenuItem[] = [];

        for (let i = 0; i < dataLines.length; i++) {
            const rawRow = dataLines[i];
            // Split respecting basic quotes
            const cols = rawRow.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (cols.length === 0 || cols.every((c) => !c)) continue;

            const name = (hasHeader && nameIdx !== -1 ? cols[nameIdx] : cols[0]) || "";
            const cat = (hasHeader && catIdx !== -1 ? cols[catIdx] : cols[1]) || "General";
            const priceStr = (hasHeader && priceIdx !== -1 ? cols[priceIdx] : cols[2]) || "";
            const costPriceStr = hasHeader && costPriceIdx !== -1 ? cols[costPriceIdx] : cols[3];
            const stationStr = hasHeader && stationIdx !== -1 ? cols[stationIdx] : cols[4];
            const desc = hasHeader && descIdx !== -1 ? cols[descIdx] : cols[5];

            // Clean price
            const cleanPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
            const cleanCost = costPriceStr ? parseFloat(costPriceStr.replace(/[^0-9.]/g, "")) : undefined;

            // Guess station from string or category
            let station: "kitchen" | "bar" = "kitchen";
            const stationLower = (stationStr || "").toLowerCase();
            const catLower = cat.toLowerCase();
            if (
                stationLower.includes("bar") ||
                stationLower.includes("drink") ||
                catLower.includes("drink") ||
                catLower.includes("cocktail") ||
                catLower.includes("beer") ||
                catLower.includes("wine") ||
                catLower.includes("spirit") ||
                catLower.includes("bottle") ||
                catLower.includes("tequila") ||
                catLower.includes("cognac") ||
                catLower.includes("whiskey") ||
                catLower.includes("champagne")
            ) {
                station = "bar";
            }

            let status: "valid" | "error" = "valid";
            let errorMsg: string | undefined;

            if (!name) {
                status = "error";
                errorMsg = "Item name is required";
            } else if (isNaN(cleanPrice) || cleanPrice <= 0) {
                status = "error";
                errorMsg = "Valid price required";
            }

            results.push({
                name,
                category: cat || "General",
                price: isNaN(cleanPrice) ? 0 : cleanPrice,
                costPrice: isNaN(cleanCost || NaN) ? undefined : cleanCost,
                station,
                description: desc || undefined,
                status,
                errorMsg,
            });
        }

        setParsedItems(results);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setRawText(content);
            parseCsvText(content);
        };
        reader.readAsText(file);
    };

    const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setRawText(text);
        parseCsvText(text);
    };

    const validCount = parsedItems.filter((p) => p.status === "valid").length;
    const errorCount = parsedItems.filter((p) => p.status === "error").length;

    const handleImport = async () => {
        const validItems = parsedItems.filter((p) => p.status === "valid");
        if (validItems.length === 0) {
            toast.error("No valid menu items to import.");
            return;
        }

        setIsImporting(true);
        try {
            // 1. Group unique categories
            const categoryMap = new Map<string, string>();
            existingCategories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

            const uniqueCats = Array.from(new Set(validItems.map((i) => i.category.trim()))).filter(Boolean);

            // Auto-create any missing categories
            for (const catName of uniqueCats) {
                const lower = catName.toLowerCase();
                if (!categoryMap.has(lower)) {
                    try {
                        const { data: newCat } = await db.createMenuCategory(venueId, catName);
                        if (newCat?.id) {
                            categoryMap.set(lower, newCat.id);
                        }
                    } catch (catErr) {
                        console.warn("[BulkUpload] Auto-create category warning:", catErr);
                    }
                }
            }

            // 2. Format batch products for insertion
            const productsToInsert = validItems.map((item) => ({
                venue_id: venueId,
                category_id: categoryMap.get(item.category.toLowerCase().trim()) || null,
                name: item.name.trim(),
                description: item.description?.trim() || null,
                price: item.price,
                cost_price: item.costPrice || null,
                station: item.station,
                is_active: true,
                is_archived: false,
                images: [],
            }));

            // 3. Batch insert directly into Supabase
            const { error } = await supabase.from("products").insert(productsToInsert);
            if (error) throw error;

            toast.success(`Successfully imported ${validItems.length} menu items!`, { icon: "🎉", duration: 4000 });
            onSuccess();
            onClose();
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            console.error("[BulkUpload] Import error:", err);
            toast.error(`Import failed: ${errorObj?.message || "Unknown database error"}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-licorice/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-3xl rounded-[1.75rem] border border-licorice/10 bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-velvet-scale-in max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-isabelline pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                            <ArrowUpTrayIcon className="h-5 w-5 stroke-[2.2]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-licorice">Bulk Upload Menu Items</h2>
                            <p className="text-xs text-feldgrau">
                                Import drinks, bottles, and food items in bulk using an Excel spreadsheet or CSV.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 text-feldgrau hover:bg-isabelline hover:text-licorice"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Sub-actions & Template */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-isabelline/40 p-3 border border-licorice/8">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMode("file")}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                                mode === "file" ? "bg-licorice text-isabelline shadow-xs" : "text-feldgrau hover:text-licorice"
                            }`}
                        >
                            Upload File (.csv)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("paste")}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                                mode === "paste" ? "bg-licorice text-isabelline shadow-xs" : "text-feldgrau hover:text-licorice"
                            }`}
                        >
                            Copy & Paste Rows
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-licorice/15 bg-white px-3 py-1.5 text-xs font-bold text-licorice hover:bg-isabelline transition-all"
                    >
                        <DocumentArrowDownIcon className="h-4 w-4 text-emerald-600" />
                        Download Sample Template (.CSV)
                    </button>
                </div>

                {/* Input Body */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {mode === "file" ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer rounded-2xl border-2 border-dashed border-licorice/20 bg-isabelline/20 p-8 text-center hover:border-licorice/40 hover:bg-isabelline/40 transition-all flex flex-col items-center justify-center"
                        >
                            <label htmlFor={fileInputId} className="sr-only">Upload menu CSV or Excel file</label>
                            <input
                                id={fileInputId}
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt,.tsv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-licorice/10 text-licorice mb-3">
                                <DocumentTextIcon className="h-6 w-6 stroke-[1.75]" />
                            </div>
                            <p className="text-sm font-bold text-licorice">
                                {fileName ? `Selected: ${fileName}` : "Click or drag your CSV/Excel file here"}
                            </p>
                            <p className="text-xs text-feldgrau mt-1">Supports standard CSV, TSV, or comma-separated exports</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-feldgrau">
                                Paste Spreadsheet Rows (from Excel or Google Sheets)
                            </label>
                            <textarea
                                value={rawText}
                                onChange={handlePasteChange}
                                rows={6}
                                placeholder={`Name\tCategory\tPrice\tCost Price\tStation\nDon Julio 1942\tTequila\t2500\t1200\tbar\nHennessy VSOP\tCognac\t950\t450\tbar\nCrispy Wings\tStarters\t85\t32\tkitchen`}
                                className="w-full rounded-2xl border border-licorice/15 bg-white p-3 font-mono text-xs text-licorice shadow-xs focus:border-licorice focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Preview Table */}
                    {parsedItems.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-licorice">
                                <span>Preview Items ({parsedItems.length} detected)</span>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                        ✓ {validCount} valid
                                    </span>
                                    {errorCount > 0 && (
                                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
                                            ✕ {errorCount} errors
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="max-h-56 overflow-y-auto rounded-xl border border-licorice/10 bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-isabelline/60 border-b border-licorice/10 text-feldgrau text-[10px] uppercase font-bold sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2">Item Name</th>
                                            <th className="px-3 py-2">Category</th>
                                            <th className="px-3 py-2">Price</th>
                                            <th className="px-3 py-2">Station</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-licorice/8 font-mono">
                                        {parsedItems.map((item, idx) => (
                                            <tr key={idx} className={item.status === "error" ? "bg-rose-50/50" : "hover:bg-isabelline/20"}>
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    {item.status === "valid" ? (
                                                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 inline" />
                                                    ) : (
                                                        <span className="text-[10px] text-rose-600 flex items-center gap-1 font-sans font-bold">
                                                            <ExclamationCircleIcon className="h-3.5 w-3.5" />
                                                            {item.errorMsg}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 font-sans font-bold text-licorice">{item.name || "—"}</td>
                                                <td className="px-3 py-1.5 font-sans text-feldgrau">{item.category}</td>
                                                <td className="px-3 py-1.5 font-bold text-licorice">{formatGHS(item.price)}</td>
                                                <td className="px-3 py-1.5 font-sans">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                                            item.station === "bar" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                                        }`}
                                                    >
                                                        {item.station}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between border-t border-isabelline pt-4">
                    <p className="text-xs text-feldgrau">
                        {validCount > 0 ? `Ready to import ${validCount} items` : "Upload or paste items to preview"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-feldgrau hover:text-licorice"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={validCount === 0 || isImporting}
                            onClick={handleImport}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-licorice px-5 py-2.5 text-xs font-bold text-isabelline shadow-md hover:bg-licorice/90 active:scale-95 disabled:opacity-50 transition-all"
                        >
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            {isImporting ? "Importing..." : `Import ${validCount} Items`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
