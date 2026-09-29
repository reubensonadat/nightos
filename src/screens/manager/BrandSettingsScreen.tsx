import { useState, useEffect, useMemo } from "react";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  PaintBrushIcon,
  PhotoIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  FireIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { db, type DbVenue } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { formatGHS } from "../../data/menu";
import { ConfirmModal } from "../../components/ConfirmModal";
import { applyBrandTheme } from "../../lib/theme";

type Props = {
  venueId?: string;
};

type FilterCategory = "all" | "brand" | "venue" | "operations" | "fees";

const COLOR_PRESETS = [
  { name: "Midnight Amber", primary: "#1C130D", accent: "#C5A880", secondary: "#F3F3E3" },
  { name: "Obsidian Gold", primary: "#121212", accent: "#D4AF37", secondary: "#F7F6F2" },
  { name: "Royal Emerald", primary: "#0A2318", accent: "#52B788", secondary: "#F0F7F4" },
  { name: "Midnight Navy", primary: "#0D1B2A", accent: "#64DFDF", secondary: "#F0F4F8" },
  { name: "Burgundy Lounge", primary: "#2B0914", accent: "#E07A5F", secondary: "#FAF4F3" },
  { name: "Velvet Night", primary: "#23140C", accent: "#D0BA98", secondary: "#F3F3E3" },
];

export function BrandSettingsScreen({ venueId }: Props) {
  const { venue: authVenue, refreshVenue } = useAuth();
  const effectiveVenueId = venueId || authVenue?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [venue, setVenue] = useState<DbVenue | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Filter & Search states
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form states - Profile
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Service Charge & Tax
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(true);
  const [serviceChargePct, setServiceChargePct] = useState<number>(10.0);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState<number>(12.5);
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [paymentModel, setPaymentModel] = useState<"PREPAY" | "POSTPAY">("POSTPAY");

  // Operations - Nightclub & Bar Mode
  const [pureBarMode, setPureBarMode] = useState(false);
  const [vipTableMinSpend, setVipTableMinSpend] = useState<number>(0);

  // Brand colors
  const [primaryColor, setPrimaryColor] = useState("#23140C");
  const [accentColor, setAccentColor] = useState("#D0BA98");
  const [secondaryColor, setSecondaryColor] = useState("#F3F3E3");

  const populateFromVenue = (data: DbVenue) => {
    setVenue(data);
    setName(data.name || "");
    setDescription(data.description || "");
    setLogoUrl(data.logo_url || "");
    setAddress(data.address || "");
    setPhone(data.phone || "");
    setEmail(data.email || "");

    const hasSvc = (data.service_charge_pct ?? 0) > 0;
    setServiceChargeEnabled(hasSvc || (data.service_charge_pct === null || data.service_charge_pct === undefined));
    setServiceChargePct(hasSvc ? data.service_charge_pct : 10.0);

    const hasVat = (data.vat_pct ?? 0) > 0;
    setVatEnabled(hasVat);
    setVatPct(hasVat ? data.vat_pct : 12.5);

    setTaxInclusive(data.tax_inclusive ?? true);
    setPaymentModel(data.payment_model ?? "POSTPAY");

    const pColor = data.brand_primary || "#23140C";
    const aColor = data.brand_accent || "#D0BA98";
    const sColor = data.brand_secondary || "#F3F3E3";
    setPrimaryColor(pColor);
    setAccentColor(aColor);
    setSecondaryColor(sColor);

    // Apply colors live to DOM
    applyBrandTheme(pColor, aColor, sColor);
  };

  useEffect(() => {
    if (!effectiveVenueId) return;
    let cancelled = false;

    db.venueById(effectiveVenueId).then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not load venue settings.");
        setLoading(false);
        return;
      }
      populateFromVenue(data);

      // Fetch operational settings (pure bar toggle, VIP min spend)
      try {
        const [{ data: barMode }, { data: minSpend }] = await Promise.all([
          db.getVenueSetting(effectiveVenueId, 'pure_bar_mode', 0),
          db.getVenueSetting(effectiveVenueId, 'vip_table_min_spend', 0),
        ]);
        if (barMode !== null && barMode !== undefined) setPureBarMode(Boolean(barMode));
        if (minSpend !== null && minSpend !== undefined) {
          setVipTableMinSpend(Number(minSpend) || 0);
        }
      } catch {
        /* fallback to defaults */
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveVenueId]);

  const handleColorChange = (newPrimary?: string, newAccent?: string, newSecondary?: string) => {
    const p = newPrimary ?? primaryColor;
    const a = newAccent ?? accentColor;
    const s = newSecondary ?? secondaryColor;
    if (newPrimary !== undefined) setPrimaryColor(p);
    if (newAccent !== undefined) setAccentColor(a);
    if (newSecondary !== undefined) setSecondaryColor(s);
    applyBrandTheme(p, a, s);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!effectiveVenueId) {
      toast.error("No active venue selected.");
      return;
    }

    setSaving(true);
    try {
      const computedVat = vatEnabled ? Number(vatPct) || 0 : 0;
      const computedSvc = serviceChargeEnabled ? Number(serviceChargePct) || 10.0 : 0;

      const updates: Partial<DbVenue> = {
        name: name.trim(),
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        vat_pct: computedVat,
        service_charge_pct: computedSvc,
        tax_inclusive: taxInclusive,
        payment_model: paymentModel,
        brand_primary: primaryColor,
        brand_accent: accentColor,
        brand_secondary: secondaryColor,
      };

      const { data, error } = await db.updateVenue(effectiveVenueId, updates);
      if (error || !data) throw error || new Error("Failed to update venue");

      // Save operational settings
      try {
        await Promise.all([
          db.setVenueSetting(effectiveVenueId, 'pure_bar_mode', pureBarMode ? 1 : 0),
          db.setVenueSetting(effectiveVenueId, 'kitchen_display_enabled', pureBarMode ? 0 : 1),
          db.setVenueSetting(effectiveVenueId, 'vip_table_min_spend', vipTableMinSpend),
        ]);
      } catch {
        /* non-fatal */
      }

      populateFromVenue(data);
      applyBrandTheme(primaryColor, accentColor, secondaryColor);
      await refreshVenue();
      toast.success("Brand & venue settings saved successfully!", { icon: "✨" });
    } catch (err) {
      console.error("[BrandSettings] updateVenue error:", err);
      toast.error("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (venue) {
      populateFromVenue(venue);
      toast("Unsaved changes reverted", { icon: "↩️" });
    }
  };

  const handleResetDefaults = () => {
    setName(venue?.name || "");
    setDescription("");
    setLogoUrl("");
    setAddress("");
    setPhone("");
    setEmail("");
    setServiceChargeEnabled(true);
    setServiceChargePct(10.0);
    setVatEnabled(false);
    setVatPct(12.5);
    setTaxInclusive(true);
    setPaymentModel("POSTPAY");
    setPureBarMode(false);
    setVipTableMinSpend(0);
    setPrimaryColor("#23140C");
    setAccentColor("#D0BA98");
    setSecondaryColor("#F3F3E3");
    applyBrandTheme("#23140C", "#D0BA98", "#F3F3E3");
    setShowResetModal(false);
    toast.success("Reset settings to default values!");
  };

  // Live bill preview calculation for GH₵ 100 base order
  const previewBase = 100;
  const svcAmount = serviceChargeEnabled ? Math.round(previewBase * (Number(serviceChargePct) / 100) * 100) / 100 : 0;
  const vatRate = vatEnabled ? Number(vatPct) || 0 : 0;
  let previewSubtotal = previewBase;
  let previewVatAmount = 0;
  let previewTotal = previewBase + svcAmount;

  if (vatEnabled && vatRate > 0) {
    if (taxInclusive) {
      previewSubtotal = Math.round((previewBase / (1 + vatRate / 100)) * 100) / 100;
      previewVatAmount = Math.round((previewBase - previewSubtotal) * 100) / 100;
      previewTotal = Math.round((previewBase + svcAmount) * 100) / 100;
    } else {
      previewSubtotal = previewBase;
      previewVatAmount = Math.round(previewBase * (vatRate / 100) * 100) / 100;
      previewTotal = Math.round((previewSubtotal + svcAmount + previewVatAmount) * 100) / 100;
    }
  }

  // Filter sections visibility based on active category & search query
  const searchLower = searchQuery.toLowerCase().trim();
  const shouldShowSection = (category: FilterCategory, keywords: string[]) => {
    const matchesCategory = activeCategory === "all" || activeCategory === category;
    if (!matchesCategory) return false;
    if (!searchLower) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(searchLower));
  };

  const showBrandSection = shouldShowSection("brand", ["brand", "color", "palette", "preset", "logo", "primary", "accent", "theme", "styling"]);
  const showVenueSection = shouldShowSection("venue", ["venue", "name", "address", "phone", "email", "description", "tagline", "profile", "contact"]);
  const showOperationsSection = shouldShowSection("operations", ["operation", "mode", "bar", "nightclub", "kitchen", "kds", "vip", "table", "min spend", "deposit", "2000", "walk-in"]);
  const showFeesSection = shouldShowSection("fees", ["fee", "service charge", "10%", "vat", "tax", "pricing", "postpay", "prepay", "receipt"]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-licorice/8 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-licorice text-isabelline shadow-md">
            <BuildingStorefrontIcon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-licorice sm:text-3xl">
                Brand & Venue Settings
              </h1>
              <span className="inline-flex items-center rounded-full bg-isabelline px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-feldgrau border border-licorice/10">
                Manager
              </span>
            </div>
            <p className="mt-1 text-xs text-feldgrau">
              Configure venue profile, 10% service charge, bar/kitchen operations, and live brand colors.
            </p>
          </div>
        </div>

        {/* Top Header Default Pill Button */}
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold tracking-tight text-licorice border border-licorice/15 shadow-sm transition-all hover:bg-isabelline active:scale-95"
        >
          <ArrowPathIcon className="h-3.5 w-3.5 text-feldgrau" strokeWidth={2.25} />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-licorice/8 shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All Settings", icon: AdjustmentsHorizontalIcon },
            { id: "brand", label: "Branding & Colors", icon: PaintBrushIcon },
            { id: "fees", label: "10% Service & VAT", icon: CurrencyDollarIcon },
            { id: "operations", label: "Bar & VIP Operations", icon: TableCellsIcon },
            { id: "venue", label: "Venue Profile", icon: BuildingStorefrontIcon },
          ].map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as FilterCategory)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-licorice text-isabelline shadow-sm"
                    : "text-feldgrau hover:text-licorice hover:bg-isabelline/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-feldgrau/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings…"
            className="w-full rounded-xl border border-licorice/12 bg-isabelline/30 pl-9 pr-3.5 py-1.5 text-xs font-semibold text-licorice placeholder:text-feldgrau/50 focus:border-licorice focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* ── SECTION 1: BRAND PALETTE & LIVE THEME ── */}
        {showBrandSection && (
          <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
            <div className="flex items-center justify-between border-b border-isabelline pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
                  <PaintBrushIcon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-licorice">Brand Palette & Styling</h2>
                  <p className="text-xs text-feldgrau">
                    Colors update live on this screen and apply across all QR menus, waiter screens, and dashboards.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <SparklesIcon className="h-3.5 w-3.5" />
                Live Theme Active
              </span>
            </div>

            {/* Preset Swatches */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-3">
                Curated Nightclub & Lounge Presets (Click to preview live)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected =
                    primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                    accentColor.toLowerCase() === preset.accent.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleColorChange(preset.primary, preset.accent, preset.secondary)}
                      className={`flex flex-col items-center gap-2.5 rounded-2xl p-3.5 text-center transition-all ${
                        isSelected
                          ? "bg-licorice text-isabelline shadow-md ring-2 ring-khaki scale-[1.02]"
                          : "bg-isabelline/40 text-licorice border border-licorice/8 hover:border-licorice/20 hover:bg-isabelline/80 active:scale-95"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-5 w-5 rounded-full border border-white/30 shadow-sm"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-white/30 shadow-sm"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <span className="text-[11px] font-bold tracking-tight">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-isabelline">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Primary Color (Dark theme background / buttons)
                </label>
                <div className="flex items-center gap-3">
                  <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-licorice/20 shadow-sm overflow-hidden transition-transform active:scale-95" title="Click to pick primary color">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handleColorChange(e.target.value, undefined, undefined)}
                      className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                    />
                    <span className="h-full w-full rounded-full" style={{ backgroundColor: primaryColor }} />
                  </label>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => handleColorChange(e.target.value, undefined, undefined)}
                    className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-2 font-mono text-xs font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Accent Color (Gold / Amber / Highlight)
                </label>
                <div className="flex items-center gap-3">
                  <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-licorice/20 shadow-sm overflow-hidden transition-transform active:scale-95" title="Click to pick accent color">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => handleColorChange(undefined, e.target.value, undefined)}
                      className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                    />
                    <span className="h-full w-full rounded-full" style={{ backgroundColor: accentColor }} />
                  </label>
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => handleColorChange(undefined, e.target.value, undefined)}
                    className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-2 font-mono text-xs font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Secondary Surface (Light Ivory / Background)
                </label>
                <div className="flex items-center gap-3">
                  <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-licorice/20 shadow-sm overflow-hidden transition-transform active:scale-95" title="Click to pick secondary color">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => handleColorChange(undefined, undefined, e.target.value)}
                      className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                    />
                    <span className="h-full w-full rounded-full" style={{ backgroundColor: secondaryColor }} />
                  </label>
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => handleColorChange(undefined, undefined, e.target.value)}
                    className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-2 font-mono text-xs font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 2: 10% SERVICE CHARGE & TAXES ── */}
        {showFeesSection && (
          <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
            <div className="flex items-center gap-3 border-b border-isabelline pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
                <CurrencyDollarIcon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-licorice">10% Service Charge & Taxes</h2>
                <p className="text-xs text-feldgrau">
                  Replaced the tiered 1–15 GHS fees with a unified 10% service charge. Configure VAT and pricing display.
                </p>
              </div>
            </div>

            <div className="divide-y divide-licorice/10">
              {/* 1. Flat 10% Service Charge */}
              <div className="pb-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-licorice">10% Venue Service Charge</h3>
                      <span className="inline-flex rounded-full bg-khaki/20 px-2 py-0.5 text-[10px] font-bold text-licorice">
                        Active Schedule
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-feldgrau">
                      A flat percentage added to every table and bar order, replacing arbitrary 1, 2, 3, 4, 5... fixed fees.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceChargeEnabled((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${
                      serviceChargeEnabled ? "bg-licorice" : "bg-isabelline ring-1 ring-licorice/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        serviceChargeEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {serviceChargeEnabled && (
                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-feldgrau">Service Charge (%):</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={serviceChargePct}
                        onChange={(e) => setServiceChargePct(parseFloat(e.target.value) || 0)}
                        className="w-28 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-1.5 font-mono text-sm font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-feldgrau">%</span>
                    </div>
                    <span className="text-xs text-feldgrau/80">
                      (Recommended: 10% standard)
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Value Added Tax (VAT) */}
              <div className="py-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-licorice">Value Added Tax (VAT)</h3>
                    <p className="mt-0.5 text-xs text-feldgrau">
                      Turn ON if your venue charges Value Added Tax on guest orders and receipts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVatEnabled((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${
                      vatEnabled ? "bg-licorice" : "bg-isabelline ring-1 ring-licorice/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        vatEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {vatEnabled && (
                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-feldgrau">VAT Rate (%):</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={vatPct}
                        onChange={(e) => setVatPct(parseFloat(e.target.value) || 0)}
                        className="w-28 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-1.5 font-mono text-sm font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-feldgrau">%</span>
                    </div>
                    <span className="text-xs text-feldgrau/80">
                      (Ghana standard: 12.5% – 15%)
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Menu Pricing Model */}
              <div className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-licorice">Menu Pricing Model</h3>
                  <p className="mt-0.5 text-xs text-feldgrau">
                    Choose whether menu prices shown to guests include tax or if tax is calculated at checkout.
                  </p>
                </div>
                <div className="inline-flex shrink-0 rounded-xl bg-isabelline/40 p-1 border border-licorice/10">
                  <button
                    type="button"
                    onClick={() => setTaxInclusive(false)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      !taxInclusive
                        ? "bg-licorice text-isabelline shadow-sm"
                        : "text-feldgrau hover:text-licorice"
                    }`}
                  >
                    Tax Exclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxInclusive(true)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      taxInclusive
                        ? "bg-licorice text-isabelline shadow-sm"
                        : "text-feldgrau hover:text-licorice"
                    }`}
                  >
                    Tax Inclusive (Default)
                  </button>
                </div>
              </div>

              {/* 4. Live Guest Receipt Preview */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <DocumentCheckIcon className="h-5 w-5 text-licorice" strokeWidth={2} />
                    <span className="text-xs font-bold uppercase tracking-wider text-licorice">
                      Receipt Math Preview (GH₵ 100 Sample Item)
                    </span>
                  </div>
                  <span className="rounded-full bg-isabelline px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-feldgrau border border-licorice/10">
                    {taxInclusive ? "Tax Inclusive" : "Tax Exclusive"}
                  </span>
                </div>

                <div className="mx-auto max-w-md rounded-xl border border-licorice/10 bg-isabelline/20 p-5 font-mono text-xs text-licorice">
                  <div className="text-center pb-3 border-b border-dashed border-licorice/15">
                    <p className="font-serif font-bold text-sm text-licorice uppercase tracking-widest">{name || venue?.name || "YOUR VENUE"}</p>
                    <p className="text-[10px] text-feldgrau uppercase tracking-wider">Itemized Receipt Preview</p>
                  </div>

                  <div className="py-3 space-y-2">
                    <div className="flex justify-between">
                      <span>1x Bottle Service / Drink</span>
                      <span>{formatGHS(previewBase)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dashed border-licorice/15 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-feldgrau">
                      <span>Subtotal {taxInclusive && vatEnabled ? "(Net)" : ""}</span>
                      <span>{formatGHS(previewSubtotal)}</span>
                    </div>
                    {serviceChargeEnabled && (
                      <div className="flex justify-between text-amber-900 font-semibold">
                        <span>Service Charge ({serviceChargePct}%)</span>
                        <span>{formatGHS(svcAmount)}</span>
                      </div>
                    )}
                    {vatEnabled && (
                      <div className="flex justify-between text-feldgrau">
                        <span>VAT ({vatPct}% {taxInclusive ? "incl." : "added"})</span>
                        <span>{formatGHS(previewVatAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-licorice/15 text-sm font-bold text-licorice">
                      <span>TOTAL PAYABLE</span>
                      <span className="text-base font-black">{formatGHS(previewTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: NIGHTCLUB OPERATIONS (BAR & VIP TABLES) ── */}
        {showOperationsSection && (
          <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
            <div className="flex items-center gap-3 border-b border-isabelline pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
                <TableCellsIcon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-licorice">Nightclub Operations & Table Rules</h2>
                <p className="text-xs text-feldgrau">
                  Unified operation: VIP tables with minimum spend deposits alongside walk-in bar rail tabs.
                </p>
              </div>
            </div>

            <div className="divide-y divide-licorice/10">
              {/* 1. Pure Bar Mode Toggle */}
              <div className="pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-licorice">Pure Bar Mode</h3>
                    {pureBarMode ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                        Pure Bar Active (Drinks Only)
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        Kitchen Display System Active (Default)
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-feldgrau">
                    {pureBarMode
                      ? "Pure Bar Mode is active. Food kitchen tickets and display routing are hidden. All orders route directly to the bar."
                      : "Default mode: Kitchen Display System is active. Orders with food route to the kitchen, and drink orders route to the bar."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPureBarMode((v) => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${
                    pureBarMode ? "bg-amber-600" : "bg-licorice"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      pureBarMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* 2. VIP Table Minimum Spend / Deposit */}
              <div className="py-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-licorice">VIP Table Upfront Deposit Credit</h3>
                    <p className="mt-0.5 text-xs text-feldgrau">
                      Default is GH₵ 0 (standard pay-as-you-go). You can set a minimum upfront spend (e.g. GH₵ 2,000) for VIP tables, which is credited toward guest orders.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-feldgrau">GH₵</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={vipTableMinSpend}
                        onChange={(e) => setVipTableMinSpend(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-32 rounded-xl border border-licorice/15 bg-isabelline/30 pl-10 pr-3 py-1.5 font-mono text-sm font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-feldgrau">Presets:</span>
                  {[
                    { label: "GH₵ 0 (Standard / No Deposit)", value: 0 },
                    { label: "GH₵ 500", value: 500 },
                    { label: "GH₵ 1,000", value: 1000 },
                    { label: "GH₵ 2,000 (VIP Table Credit)", value: 2000 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setVipTableMinSpend(preset.value)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        vipTableMinSpend === preset.value
                          ? "bg-licorice text-isabelline shadow-sm"
                          : "bg-isabelline/60 text-licorice hover:bg-isabelline border border-licorice/10"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-isabelline/40 p-3.5 border border-licorice/8 text-xs text-feldgrau flex items-center gap-2.5">
                  <FireIcon className="h-4 w-4 text-khaki shrink-0" />
                  <span>
                    <strong>Unified Ledger:</strong> Guests at VIP Tables start with GH₵ {vipTableMinSpend.toLocaleString()} credit. Walk-in Bar Rail tabs remain GH₵ 0.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 4: VENUE PROFILE & IDENTITY ── */}
        {showVenueSection && (
          <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
            <div className="flex items-center gap-3 border-b border-isabelline pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
                <PhotoIcon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-licorice">Venue Profile & Contact</h2>
                <p className="text-xs text-feldgrau">
                  Details visible to guests on QR landing pages, receipts, and order tickets.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Venue Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Velvet Lounge"
                  className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Tagline / Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Cocktail Bar & Nightclub"
                  className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Logo URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-licorice text-isabelline font-serif text-lg font-bold shadow-sm overflow-hidden">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Venue logo preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      (name ? name.charAt(0) : "V").toUpperCase()
                    )}
                  </div>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 24 123 4567"
                  className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@venue.com"
                  className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 14 Osu Oxford Street, Accra, Ghana"
                  className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Standard Bottom Action Bar ── */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-licorice/10">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-xl border border-licorice/15 bg-isabelline/40 px-5 py-2.5 text-xs font-bold text-licorice transition-all hover:bg-isabelline active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-licorice px-6 py-2.5 text-xs font-bold text-isabelline shadow-md transition-all hover:bg-licorice/90 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-isabelline border-t-transparent" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 text-khaki" strokeWidth={2.25} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset Settings to Default?"
        body="Are you sure you want to reset all venue branding, tax rates, 10% service charge, and nightclub rules back to default values? Any unsaved changes will be lost."
        confirmLabel="Reset to Default"
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={handleResetDefaults}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}
