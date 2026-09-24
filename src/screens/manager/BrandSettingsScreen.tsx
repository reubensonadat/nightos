import { useState, useEffect } from "react";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  PaintBrushIcon,
  PhotoIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { db, type DbVenue } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { formatGHS } from "../../data/menu";
import { ConfirmModal } from "../../components/ConfirmModal";

type Props = {
  venueId?: string;
};

const COLOR_PRESETS = [
  { name: "Midnight Amber", primary: "#1C130D", accent: "#C5A880" },
  { name: "Obsidian Gold", primary: "#121212", accent: "#D4AF37" },
  { name: "Royal Emerald", primary: "#0A2318", accent: "#52B788" },
  { name: "Midnight Navy", primary: "#0D1B2A", accent: "#64DFDF" },
  { name: "Burgundy Lounge", primary: "#2B0914", accent: "#E07A5F" },
];

export function BrandSettingsScreen({ venueId }: Props) {
  const { venue: authVenue, refreshVenue } = useAuth();
  const effectiveVenueId = venueId || authVenue?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [venue, setVenue] = useState<DbVenue | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Tax & Fees
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState<number>(12.5);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePct, setServiceChargePct] = useState<number>(10);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [paymentModel, setPaymentModel] = useState<"PREPAY" | "POSTPAY">("POSTPAY");

  // Brand colors
  const [primaryColor, setPrimaryColor] = useState("#1C130D");
  const [accentColor, setAccentColor] = useState("#C5A880");

  const populateFromVenue = (data: DbVenue) => {
    setVenue(data);
    setName(data.name || "");
    setDescription(data.description || "");
    setLogoUrl(data.logo_url || "");
    setAddress(data.address || "");
    setPhone(data.phone || "");
    setEmail(data.email || "");

    const hasVat = (data.vat_pct ?? 0) > 0;
    setVatEnabled(hasVat);
    setVatPct(hasVat ? data.vat_pct : 12.5);

    const hasService = (data.service_charge_pct ?? 0) > 0;
    setServiceChargeEnabled(hasService);
    setServiceChargePct(hasService ? data.service_charge_pct : 10);

    setTaxInclusive(data.tax_inclusive ?? false);
    setPaymentModel(data.payment_model ?? "POSTPAY");

    setPrimaryColor(data.brand_primary || "#1C130D");
    setAccentColor(data.brand_accent || "#C5A880");
  };

  useEffect(() => {
    if (!effectiveVenueId) return;
    let cancelled = false;

    db.venueById(effectiveVenueId).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not load venue settings.");
        setLoading(false);
        return;
      }
      populateFromVenue(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveVenueId]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!effectiveVenueId) {
      toast.error("No active venue selected.");
      return;
    }

    setSaving(true);
    try {
      const computedVat = vatEnabled ? Number(vatPct) || 0 : 0;
      const computedService = serviceChargeEnabled ? Number(serviceChargePct) || 0 : 0;

      const updates: Partial<DbVenue> = {
        name: name.trim(),
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        vat_pct: computedVat,
        service_charge_pct: computedService,
        tax_inclusive: taxInclusive,
        payment_model: paymentModel,
        brand_primary: primaryColor,
        brand_accent: accentColor,
      };

      const { data, error } = await db.updateVenue(effectiveVenueId, updates);
      if (error || !data) throw error || new Error("Failed to update venue");

      populateFromVenue(data);
      await refreshVenue();
      toast.success("Brand & Tax settings saved successfully!", { icon: "✨" });
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
    setVatEnabled(false);
    setVatPct(12.5);
    setServiceChargeEnabled(false);
    setServiceChargePct(10);
    setTaxInclusive(false);
    setPaymentModel("POSTPAY");
    setPrimaryColor("#1C130D");
    setAccentColor("#C5A880");
    setShowResetModal(false);
    toast.success("Reset settings to default values!");
  };

  // Live bill preview calculation for GH₵ 100 base order
  const previewBase = 100;
  const previewVatAmount = vatEnabled ? Math.round(previewBase * (vatPct / 100) * 100) / 100 : 0;
  const previewServiceAmount = serviceChargeEnabled
    ? Math.round(previewBase * (serviceChargePct / 100) * 100) / 100
    : 0;
  const previewTotal = taxInclusive
    ? previewBase
    : previewBase + previewVatAmount + previewServiceAmount;

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
              Configure venue profile, customer receipts, tax calculations, and brand styling.
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
          <span>Default</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* ── SECTION 1: VENUE PROFILE & IDENTITY ── */}
        <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
          <div className="flex items-center gap-3 border-b border-isabelline pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
              <PhotoIcon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-licorice">Venue Profile & Branding</h2>
              <p className="text-xs text-feldgrau">
                Details visible to guests on QR landing pages, receipts, and order tickets.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Venue Name */}
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

            {/* Tagline / Description */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                Tagline / Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cocktail Bar & Rooftop Dining"
                className="w-full rounded-xl border border-licorice/15 bg-isabelline/30 px-4 py-2.5 text-sm font-semibold text-licorice placeholder:text-feldgrau/40 transition-all focus:border-licorice focus:bg-white focus:outline-none focus:ring-1 focus:ring-licorice"
              />
            </div>

            {/* Logo URL */}
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

            {/* Contact Phone */}
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

            {/* Contact Email */}
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

            {/* Physical Address */}
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

        {/* ── SECTION 2: TAXES, VAT & SERVICE CHARGES ── */}
        <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
          <div className="flex items-center gap-3 border-b border-isabelline pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
              <CurrencyDollarIcon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-licorice">Taxes, Fees & Pricing Rules</h2>
              <p className="text-xs text-feldgrau">
                Configuration for VAT, staff gratuity, menu pricing display, and payment workflow.
              </p>
            </div>
          </div>

          {/* Settings List */}
          <div className="divide-y divide-licorice/10">
            {/* 1. Value Added Tax (VAT) */}
            <div className="pb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-licorice">Value Added Tax (VAT)</h3>
                  <p className="mt-0.5 text-xs text-feldgrau">
                    Turn ON if your venue charges Value Added Tax on guest orders and receipts.
                  </p>
                </div>
                {/* Toggle Switch */}
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
                <div className="pt-1 animate-velvet-fade flex flex-wrap items-center gap-3">
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

            {/* 2. Service Charge (Gratuity) */}
            <div className="py-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-licorice">Service Charge</h3>
                  <p className="mt-0.5 text-xs text-feldgrau">
                    Optional venue service fee or staff gratuity added to guest bills.
                  </p>
                </div>
                {/* Toggle Switch */}
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
                <div className="pt-1 animate-velvet-fade flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-feldgrau">Service Charge Rate (%):</span>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={serviceChargePct}
                      onChange={(e) => setServiceChargePct(parseFloat(e.target.value) || 0)}
                      className="w-28 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-1.5 font-mono text-sm font-bold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-feldgrau">%</span>
                  </div>
                  <span className="text-xs text-feldgrau/80">
                    (Standard venue gratuity: 5% – 10%)
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
                  Tax Exclusive (Added at checkout)
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
                  Tax Inclusive (In menu price)
                </button>
              </div>
            </div>

            {/* 4. Guest Payment Workflow */}
            <div className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-licorice">Guest Payment Workflow</h3>
                <p className="mt-0.5 text-xs text-feldgrau">
                  Choose whether guests settle their tab when leaving (Postpay) or pay for each order upfront (Prepay).
                </p>
              </div>
              <div className="inline-flex shrink-0 rounded-xl bg-isabelline/40 p-1 border border-licorice/10">
                <button
                  type="button"
                  onClick={() => setPaymentModel("POSTPAY")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    paymentModel === "POSTPAY"
                      ? "bg-licorice text-isabelline shadow-sm"
                      : "text-feldgrau hover:text-licorice"
                  }`}
                >
                  Postpay (Pay After Meal)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModel("PREPAY")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    paymentModel === "PREPAY"
                      ? "bg-licorice text-isabelline shadow-sm"
                      : "text-feldgrau hover:text-licorice"
                  }`}
                >
                  Prepay (Pay Before Order)
                </button>
              </div>
            </div>

            {/* 5. Live Guest Receipt Math Preview */}
            <div className="pt-6 space-y-4">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <DocumentCheckIcon className="h-5 w-5 text-licorice" strokeWidth={2} />
                  <span className="text-xs font-bold uppercase tracking-wider text-licorice">
                    Live Guest Receipt Math Preview (Sample GH₵ 100 Order)
                  </span>
                </div>
                <span className="rounded-full bg-isabelline px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-feldgrau border border-licorice/10">
                  {taxInclusive ? "Tax Inclusive" : "Tax Exclusive"}
                </span>
              </div>

              {/* Receipt Card */}
              <div className="mx-auto max-w-md rounded-xl border border-licorice/10 bg-isabelline/20 p-5 font-mono text-xs text-licorice">
                <div className="text-center pb-3 border-b border-dashed border-licorice/15">
                  <p className="font-serif font-bold text-sm text-licorice uppercase tracking-widest">{name || "VENUE NAME"}</p>
                  <p className="text-[10px] text-feldgrau uppercase tracking-wider">Guest Receipt Sample</p>
                </div>

                <div className="py-3 space-y-2">
                  <div className="flex justify-between">
                    <span>1x Sample Order Item</span>
                    <span>{formatGHS(previewBase)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-licorice/15 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-feldgrau">
                    <span>Subtotal</span>
                    <span>{formatGHS(previewBase)}</span>
                  </div>
                  <div className="flex justify-between text-feldgrau">
                    <span>VAT ({vatEnabled ? `${vatPct}%` : "OFF"})</span>
                    <span>{vatEnabled ? formatGHS(previewVatAmount) : "GH₵ 0.00"}</span>
                  </div>
                  <div className="flex justify-between text-feldgrau">
                    <span>Service Charge ({serviceChargeEnabled ? `${serviceChargePct}%` : "OFF"})</span>
                    <span>{serviceChargeEnabled ? formatGHS(previewServiceAmount) : "GH₵ 0.00"}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-licorice/15 text-sm font-bold text-licorice">
                    <span>TOTAL BILL</span>
                    <span className="text-base font-black">{formatGHS(previewTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: BRAND PALETTE & THEME ── */}
        <div className="rounded-[1.75rem] border border-licorice/8 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(35,20,12,0.03)] space-y-6">
          <div className="flex items-center gap-3 border-b border-isabelline pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-isabelline text-licorice">
              <PaintBrushIcon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-licorice">Brand Palette & Styling</h2>
              <p className="text-xs text-feldgrau">
                Select preset theme colors or configure custom hex colors for customer screens.
              </p>
            </div>
          </div>

          {/* Preset Swatches */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-3">
              Curated Color Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {COLOR_PRESETS.map((preset) => {
                const isSelected =
                  primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                  accentColor.toLowerCase() === preset.accent.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setAccentColor(preset.accent);
                    }}
                    className={`flex flex-col items-center gap-2.5 rounded-2xl p-4 text-center transition-all ${
                      isSelected
                        ? "bg-licorice text-isabelline shadow-md ring-2 ring-khaki scale-[1.02]"
                        : "bg-isabelline/40 text-licorice border border-licorice/8 hover:border-licorice/20 hover:bg-isabelline/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-5 w-5 rounded-full border border-white/30 shadow-sm"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-5 w-5 rounded-full border border-white/30 shadow-sm"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="text-xs font-bold tracking-tight">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-isabelline">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                Primary Color (Headers & Primary Action Buttons)
              </label>
              <div className="flex items-center gap-3">
                <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-licorice/20 shadow-sm overflow-hidden transition-transform active:scale-95" title="Click to pick primary color">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                  />
                  <span className="h-full w-full rounded-full" style={{ backgroundColor: primaryColor }} />
                </label>
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-2 font-mono text-xs font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-1.5">
                Accent Color (Highlights & Badges)
              </label>
              <div className="flex items-center gap-3">
                <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-licorice/20 shadow-sm overflow-hidden transition-transform active:scale-95" title="Click to pick accent color">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                  />
                  <span className="h-full w-full rounded-full" style={{ backgroundColor: accentColor }} />
                </label>
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 rounded-xl border border-licorice/15 bg-isabelline/30 px-3.5 py-2 font-mono text-xs font-bold text-licorice shadow-sm focus:border-licorice focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Standard Bottom Action Bar (Non-floating) ── */}
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
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset Settings to Default?"
        body="Are you sure you want to reset all venue branding, tax rates, and pricing rules back to default values? Any unsaved changes will be lost."
        confirmLabel="Reset to Default"
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={handleResetDefaults}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}
