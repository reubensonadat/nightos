import { useState, type FormEvent } from "react";
import {
    ArrowPathIcon,
    CheckIcon,
    PaintBrushIcon,
} from "@heroicons/react/24/outline";
import { useBrand, type BrandColors } from "../../context/BrandContext";

const COLOR_LABELS: Record<keyof BrandColors, string> = {
    primary: "Primary (text, dark backgrounds)",
    secondary: "Secondary (page background, cards)",
    accent: "Accent (highlights, badges)",
    textSecondary: "Secondary Text",
    danger: "Danger (errors, alerts)",
    lightBlue: "Light Blue (soft accents)",
};

export function BrandSettingsScreen() {
    const { brand, setBrand, resetBrand, isDefault } = useBrand();
    const [draft, setDraft] = useState<BrandColors>({ ...brand });
    const [copied, setCopied] = useState(false);

    const handleApply = (e: FormEvent) => {
        e.preventDefault();
        setBrand(draft);
    };

    const handleReset = () => {
        resetBrand();
        setDraft({ ...brand });
    };

    /* ── Preview computed from draft ── */
    const previewBg = {
        backgroundColor: draft.secondary,
        color: draft.primary,
    };
    const previewCard = {
        backgroundColor: draft.secondary,
        borderColor: `${draft.primary}15`,
        color: draft.primary,
    };
    const previewButton = {
        backgroundColor: draft.primary,
        color: draft.secondary,
    };
    const previewAccent = {
        backgroundColor: `${draft.primary}12`,
        color: draft.accent,
    };

    const copyToClipboard = () => {
        const json = JSON.stringify(draft, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-[26px] font-black tracking-[-0.03em] text-brand-primary">
                        Brand Colors
                    </h1>
                    <p className="text-[12px] text-brand-text-secondary mt-0.5">
                        Customize the look and feel of your entire system
                    </p>
                </div>
                {!isDefault && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-primary text-brand-secondary px-3.5 py-2 text-[11px] font-bold tracking-tight shadow-sm hover:opacity-90 active:scale-95 transition-all"
                    >
                        <ArrowPathIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Reset Defaults
                    </button>
                )}
            </div>

            {/* ── Color Picker Grid ── */}
            <form onSubmit={handleApply} className="space-y-4">
                <div className="rounded-[1.5rem] bg-brand-secondary p-5 md:p-6 shadow-sm ring-1 ring-brand-primary/5">
                    <div className="flex items-center gap-2 mb-4">
                        <PaintBrushIcon className="h-4 w-4 text-brand-text-secondary" strokeWidth={2} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-text-secondary">Color Palette</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(Object.keys(COLOR_LABELS) as (keyof BrandColors)[]).map((key) => (
                            <div key={key}>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-text-secondary mb-1.5">
                                    {COLOR_LABELS[key]}
                                </label>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-9 w-9 shrink-0 rounded-lg border border-brand-primary/10 shadow-sm"
                                        style={{ backgroundColor: draft[key] }}
                                    />
                                    <input
                                        type="color"
                                        value={draft[key]}
                                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                                        className="h-9 w-12 rounded-lg border border-brand-primary/10 bg-transparent cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={draft[key]}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (/^#[0-9a-fA-F]{0,6}$/.test(val) && val.length >= 4) {
                                                setDraft({ ...draft, [key]: val });
                                            }
                                        }}
                                        className="flex-1 min-w-0 rounded-lg bg-brand-secondary px-2.5 py-2 text-[11px] font-mono text-brand-primary ring-1 ring-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Live Preview ── */}
                <div className="rounded-[1.5rem] bg-brand-secondary p-5 md:p-6 shadow-sm ring-1 ring-brand-primary/5" style={previewBg}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-text-secondary mb-3">Live Preview</p>

                    <div className="rounded-xl p-4 shadow-sm ring-1" style={previewCard}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[12px] font-bold tracking-tight" style={{ color: draft.primary }}>Velvet Lounge</p>
                                <p className="text-[10px]" style={{ color: draft.textSecondary }}>Manager Portal</p>
                            </div>
                            <div className="rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider" style={previewAccent}>
                                Live
                            </div>
                        </div>

                        {/* Mini stat bar */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: `${draft.primary}08` }}>
                                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: draft.textSecondary }}>Revenue</p>
                                <p className="font-mono text-[16px] font-black" style={{ color: draft.primary }}>GHS 7,240</p>
                            </div>
                            <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: `${draft.primary}08` }}>
                                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: draft.textSecondary }}>Orders</p>
                                <p className="font-mono text-[16px] font-black" style={{ color: draft.primary }}>47</p>
                            </div>
                        </div>

                        {/* Button preview */}
                        <div className="flex items-center gap-2">
                            <button type="button"
                                className="rounded-full px-4 py-2 text-[11px] font-bold tracking-tight transition-all"
                                style={previewButton}>
                                Primary
                            </button>
                            <button type="button"
                                className="rounded-full px-4 py-2 text-[11px] font-bold tracking-tight ring-1 transition-all"
                                style={{ backgroundColor: "transparent", color: draft.primary, borderColor: `${draft.primary}20` }}>
                                Secondary
                            </button>
                            <button type="button"
                                className="rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all"
                                style={previewAccent}>
                                Badge
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="flex items-center justify-between gap-2 rounded-[1.5rem] bg-brand-secondary p-4 shadow-sm ring-1 ring-brand-primary/5">
                    <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[10px] font-bold tracking-tight text-brand-text-secondary hover:text-brand-primary transition-colors"
                    >
                        {copied ? "Copied to clipboard!" : "Copy config as JSON"}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-full bg-brand-primary text-brand-secondary px-5 py-2.5 text-[12px] font-bold tracking-tight shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                            <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                            Apply Colors
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

/* ── Helper to determine if a hex color is light ── */
function isLightColor(hex: string): boolean {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return true;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}