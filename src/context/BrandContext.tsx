import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Brand Color System — replaces hardcoded colors with CSS custom properties
   Default: Black (#000000) & White (#FFFFFF) 
   ═══════════════════════════════════════════════════════════════════════════ */

export type BrandColors = {
    primary: string;       // Main brand (was licorice #23140C) → default #000000
    secondary: string;     // Surface/bg (was isabelline #F3F3E3) → default #FFFFFF
    accent: string;        // Accent (was khaki #D0BA98) → default #666666
    textSecondary: string; // Secondary text (was feldgrau #606F69) → default #888888
    danger: string;        // Danger/error (was dark-red #91040C) → default #DC2626
    lightBlue: string;     // Light blue accent (was #A9CFE0) → default #E5E7EB
};

const DEFAULT_BRAND: BrandColors = {
    primary: "#000000",
    secondary: "#FFFFFF",
    accent: "#666666",
    textSecondary: "#888888",
    danger: "#DC2626",
    lightBlue: "#E5E7EB",
};

type BrandContextValue = {
    brand: BrandColors;
    setBrand: (colors: Partial<BrandColors>) => void;
    resetBrand: () => void;
    isDefault: boolean;
};

const STORAGE_KEY = "nightos-brand-colors";

function loadBrand(): BrandColors {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_BRAND, ...parsed };
        }
    } catch {}
    return { ...DEFAULT_BRAND };
}

function applyBrandVars(brand: BrandColors) {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", brand.primary);
    root.style.setProperty("--brand-secondary", brand.secondary);
    root.style.setProperty("--brand-accent", brand.accent);
    root.style.setProperty("--brand-text-secondary", brand.textSecondary);
    root.style.setProperty("--brand-danger", brand.danger);
    root.style.setProperty("--brand-light-blue", brand.lightBlue);

    /* ── Derived / computed tints ── */
    root.style.setProperty("--brand-primary-rgb", hexToRgb(brand.primary));
    root.style.setProperty("--brand-secondary-rgb", hexToRgb(brand.secondary));
    root.style.setProperty("--brand-accent-rgb", hexToRgb(brand.accent));
    root.style.setProperty("--brand-danger-rgb", hexToRgb(brand.danger));
}

function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0,0,0";
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function colorsEqual(a: BrandColors, b: BrandColors): boolean {
    return (
        a.primary === b.primary &&
        a.secondary === b.secondary &&
        a.accent === b.accent &&
        a.textSecondary === b.textSecondary &&
        a.danger === b.danger &&
        a.lightBlue === b.lightBlue
    );
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
    const [brand, setBrandState] = useState<BrandColors>(loadBrand);

    // Apply on mount & when brand changes
    useEffect(() => {
        applyBrandVars(brand);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    }, [brand]);

    const setBrand = useCallback((partial: Partial<BrandColors>) => {
        setBrandState((prev) => ({ ...prev, ...partial }));
    }, []);

    const resetBrand = useCallback(() => {
        setBrandState({ ...DEFAULT_BRAND });
    }, []);

    const isDefault = colorsEqual(brand, DEFAULT_BRAND);

    return (
        <BrandContext.Provider value={{ brand, setBrand, resetBrand, isDefault }}>
            {children}
        </BrandContext.Provider>
    );
}

export function useBrand() {
    const ctx = useContext(BrandContext);
    if (!ctx) throw new Error("useBrand must be used within a BrandProvider");
    return ctx;
}