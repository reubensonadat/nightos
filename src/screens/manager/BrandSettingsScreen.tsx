import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    ArrowPathIcon,
    CheckIcon,
    CloudArrowUpIcon,
    PaintBrushIcon,
    PhotoIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useBrand, type BrandColors } from "../../context/BrandContext";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/api";
import { deleteFromR2, isR2Configured, uploadToR2 } from "../../lib/r2";

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
    const { venue } = useAuth();
    const venueId = venue?.id;

    const [draft, setDraft] = useState<BrandColors>({ ...brand });
    const [copied, setCopied] = useState(false);
    const [venueName, setVenueName] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingLogo, setDeletingLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const r2Ready = isR2Configured();

    // Load the venue's saved brand (colors + logo) so each restaurant
    // keeps its own identity across devices.
    useEffect(() => {
        if (!venueId) return;
        let cancelled = false;
        db.venueById(venueId).then(({ data }) => {
            if (cancelled || !data) return;
            setVenueName(data.name);
            setLogoUrl(data.logo_url);
            const saved: Partial<BrandColors> = {};
            if (data.brand_primary) saved.primary = data.brand_primary;
            if (data.brand_secondary) saved.secondary = data.brand_secondary;
            if (data.brand_accent) saved.accent = data.brand_accent;
            if (data.brand_text_secondary) saved.textSecondary = data.brand_text_secondary;
            if (data.brand_danger) saved.danger = data.brand_danger;
            if (data.brand_light_blue) saved.lightBlue = data.brand_light_blue;
            if (Object.keys(saved).length > 0) {
                setDraft({ ...brand, ...saved });
                setBrand(saved);
            }
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [venueId]);

    const handleApply = async (e: FormEvent) => {
        e.preventDefault();
        setBrand(draft);
        if (!venueId) return;
        setSaving(true);
        try {
            const { error } = await db.updateVenue(venueId, {
                brand_primary: draft.primary,
                brand_secondary: draft.secondary,
                brand_accent: draft.accent,
                brand_text_secondary: draft.textSecondary,
                brand_danger: draft.danger,
                brand_light_blue: draft.lightBlue,
            });
            if (error) throw error;
            toast.success("Brand colors saved");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save brand colors");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        resetBrand();
        setDraft({ ...brand });
    };

    const handleUpload = async (file: File | null) => {
        if (!file || !venueId) return;
        setUploading(true);
        try {
            const { url, key } = await uploadToR2(file, venueId, "logos");
            const { error } = await db.updateVenue(venueId, { logo_url: url });
            if (error) throw error;
            setLogoUrl(url);
            toast.success("Logo uploaded");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveLogo = async () => {
        if (!venueId || !logoUrl) return;
        setDeletingLogo(true);
        try {
            await deleteFromR2(logoUrl, venueId);
            const { error } = await db.updateVenue(venueId, { logo_url: null });
            if (error) throw error;
            setLogoUrl(null);
            toast.success("Logo removed");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to remove logo");
        } finally {
            setDeletingLogo(false);
        }
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
                        {venueName ? `${venueName}'s look and feel` : "Customize the look and feel of your venue"}
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

            {/* ── Logo Upload ── */}
            <div className="rounded-[1.5rem] bg-brand-secondary p-5 md:p-6 shadow-sm ring-1 ring-brand-primary/5">
                <div className="flex items-center gap-2 mb-4">
                    <PhotoIcon className="h-4 w-4 text-brand-text-secondary" strokeWidth={2} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-text-secondary">Venue Logo</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt="Venue logo"
                            className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm ring-1 ring-brand-primary/10"
                        />
                    ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/5 ring-1 ring-brand-primary/10">
                            <PhotoIcon className="h-8 w-8 text-brand-text-secondary/50" strokeWidth={1.5} />
                        </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                handleUpload(e.target.files?.[0] ?? null);
                                e.target.value = "";
                            }}
                        />
                        <button
                            type="button"
                            disabled={!r2Ready || uploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary text-brand-secondary px-4 py-2 text-[11px] font-bold tracking-tight shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    Uploading…
                                </>
                            ) : (
                                <>
                                    <CloudArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    {logoUrl ? "Replace Logo" : "Upload Logo"}
                                </>
                            )}
                        </button>

                        {logoUrl && (
                            <button
                                type="button"
                                disabled={deletingLogo}
                                onClick={handleRemoveLogo}
                                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold tracking-tight text-dark-red ring-1 ring-dark-red/25 hover:bg-dark-red/5 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <TrashIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                {deletingLogo ? "Removing…" : "Remove"}
                            </button>
                        )}
                    </div>
                </div>

                {!r2Ready && (
                    <p className="mt-3 rounded-lg bg-brand-primary/5 px-3 py-2 text-[11px] font-semibold tracking-tight text-brand-text-secondary">
                        Image uploads need Cloudflare R2 credentials on the server (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
                        R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL). The rest of branding works without it.
                    </p>
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
                            <div className="flex items-center gap-3">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${draft.primary}0d` }}>
                                        <span className="font-serif text-[14px] font-bold" style={{ color: draft.primary }}>
                                            {venueName ? venueName.charAt(0) : "V"}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[12px] font-bold tracking-tight" style={{ color: draft.primary }}>
                                        {venueName || "Velvet Lounge"}
                                    </p>
                                    <p className="text-[10px]" style={{ color: draft.textSecondary }}>Manager Portal</p>
                                </div>
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
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-primary text-brand-secondary px-5 py-2.5 text-[12px] font-bold tracking-tight shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
                        >
                            {saving ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            ) : (
                                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                            )}
                            {saving ? "Saving…" : "Apply Colors"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
