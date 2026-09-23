import { useState, useEffect } from "react";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  InformationCircleIcon,
  PaintBrushIcon,
  PhotoIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { db, type DbVenue } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { formatGHS } from "../../data/menu";

type Props = {
  venueId?: string;
};

const COLOR_PRESETS = [
  { name: "Night Velvet", primary: "#1C130D", accent: "#C5A880" },
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
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveVenueId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setVenue(data);
      await refreshVenue();
      toast.success("Brand & Tax settings updated successfully!", { icon: "✨" });
    } catch (err) {
      console.error("[BrandSettings] updateVenue error:", err);
      toast.error("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-licorice text-khaki shadow-sm">
            <BuildingStorefrontIcon className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-licorice">
              Brand & Tax Settings
            </h1>
            <p className="text-[13px] text-feldgrau">
              Configure VAT rates, service charges, customer receipt display, and venue brand styling.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* ══════════════════════════════════════════════════════════════════
            TAX & VAT CONFIGURATION
           ══════════════════════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-licorice/8">
          <div className="border-b border-licorice/6 bg-isabelline/40 px-6 py-4">
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-licorice">
                Taxes, VAT & Service Charges
              </h2>
            </div>
            <p className="mt-1 text-[12px] text-feldgrau">
              Control whether VAT and service charges are calculated on guest orders and receipts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
            {/* VAT Control */}
            <div className="space-y-4 rounded-xl border border-licorice/8 bg-isabelline/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-licorice">Value Added Tax (VAT)</h3>
                  <p className="text-[11px] text-feldgrau">
                    Turn ON if your venue charges VAT on orders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVatEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    vatEnabled ? "bg-licorice" : "bg-licorice/20"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      vatEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {vatEnabled && (
                <div className="pt-2 animate-velvet-fade">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                    VAT Rate (%)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={vatPct}
                      onChange={(e) => setVatPct(parseFloat(e.target.value) || 0)}
                      className="w-32 rounded-xl border border-licorice/15 bg-white px-3 py-2 font-mono text-[14px] font-bold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                    />
                    <span className="text-[13px] font-bold text-feldgrau">%</span>
                    <span className="text-[11px] text-feldgrau/80">
                      (Ghana standard: 12.5% – 15%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Service Charge Control */}
            <div className="space-y-4 rounded-xl border border-licorice/8 bg-isabelline/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-licorice">Service Charge</h3>
                  <p className="text-[11px] text-feldgrau">
                    Optional venue gratuity or staff service fee.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceChargeEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    serviceChargeEnabled ? "bg-licorice" : "bg-licorice/20"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      serviceChargeEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {serviceChargeEnabled && (
                <div className="pt-2 animate-velvet-fade">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                    Service Charge Rate (%)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={serviceChargePct}
                      onChange={(e) => setServiceChargePct(parseFloat(e.target.value) || 0)}
                      className="w-32 rounded-xl border border-licorice/15 bg-white px-3 py-2 font-mono text-[14px] font-bold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                    />
                    <span className="text-[13px] font-bold text-feldgrau">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tax Display Model */}
            <div className="rounded-xl border border-licorice/8 bg-isabelline/20 p-5 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-[13px] font-bold text-licorice">Menu Price Pricing Model</h3>
                  <p className="text-[11px] text-feldgrau">
                    Choose whether menu prices shown to guests already include tax or if tax is added at checkout.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white p-1 ring-1 ring-licorice/10">
                  <button
                    type="button"
                    onClick={() => setTaxInclusive(false)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                      !taxInclusive
                        ? "bg-licorice text-khaki shadow-sm"
                        : "text-feldgrau hover:text-licorice"
                    }`}
                  >
                    Tax Exclusive (Added at checkout)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxInclusive(true)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                      taxInclusive
                        ? "bg-licorice text-khaki shadow-sm"
                        : "text-feldgrau hover:text-licorice"
                    }`}
                  >
                    Tax Inclusive (In menu price)
                  </button>
                </div>
              </div>
            </div>

            {/* Live Bill Math Preview */}
            <div className="rounded-2xl bg-licorice p-5 text-isabelline lg:col-span-2 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <DocumentCheckIcon className="h-4 w-4 text-khaki" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-khaki">
                  Customer Receipt Math Preview (Sample GH₵ 100 Order)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center divide-x divide-white/10">
                <div>
                  <p className="text-[10px] uppercase text-isabelline/60 font-medium">Subtotal</p>
                  <p className="font-mono text-base font-bold mt-0.5">{formatGHS(previewBase)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-isabelline/60 font-medium">
                    VAT ({vatEnabled ? `${vatPct}%` : "OFF"})
                  </p>
                  <p className="font-mono text-base font-bold mt-0.5 text-khaki">
                    {vatEnabled ? formatGHS(previewVatAmount) : "GH₵ 0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-isabelline/60 font-medium">
                    Service ({serviceChargeEnabled ? `${serviceChargePct}%` : "OFF"})
                  </p>
                  <p className="font-mono text-base font-bold mt-0.5 text-khaki">
                    {serviceChargeEnabled ? formatGHS(previewServiceAmount) : "GH₵ 0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-khaki font-bold">Total Bill</p>
                  <p className="font-mono text-lg font-black mt-0.5 text-isabelline">
                    {formatGHS(previewTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            VENUE DETAILS & IDENTITY
           ══════════════════════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-licorice/8">
          <div className="border-b border-licorice/6 bg-isabelline/40 px-6 py-4">
            <div className="flex items-center gap-2">
              <PhotoIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-licorice">
                Venue Profile & Branding
              </h2>
            </div>
            <p className="mt-1 text-[12px] text-feldgrau">
              Customize the name, logo, and contact info displayed across customer phones, menus, and manager views.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Venue Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Velvet Lounge"
                className="mt-1.5 w-full rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Tagline / Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cocktail Bar & Rooftop Kitchen"
                className="mt-1.5 w-full rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Logo URL
              </label>
              <div className="mt-1.5 flex items-center gap-4">
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="flex-1 rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                />
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-licorice/10"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-licorice/5 text-[12px] font-bold text-feldgrau">
                    {name ? name.charAt(0) : "V"}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Contact Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 24 123 4567"
                className="mt-1.5 w-full rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@venue.com"
                className="mt-1.5 w-full rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                Physical Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 14 Osu Oxford Street, Accra, Ghana"
                className="mt-1.5 w-full rounded-xl border border-licorice/15 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-licorice shadow-sm focus:border-licorice focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            BRAND COLORS & THEME
           ══════════════════════════════════════════════════════════════════ */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-licorice/8">
          <div className="border-b border-licorice/6 bg-isabelline/40 px-6 py-4">
            <div className="flex items-center gap-2">
              <PaintBrushIcon className="h-5 w-5 text-khaki" strokeWidth={2} />
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-licorice">
                Brand Palette
              </h2>
            </div>
            <p className="mt-1 text-[12px] text-feldgrau">
              Choose signature colors for customer menus, buttons, and receipts.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Color Presets */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-3">
                Curated Presets
              </p>
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
                      className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all ${
                        isSelected
                          ? "bg-licorice text-isabelline ring-2 ring-khaki"
                          : "bg-isabelline/40 text-licorice ring-1 ring-licorice/8 hover:ring-licorice/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <span className="text-[11px] font-bold tracking-tight">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                  Primary Color (Headers & Primary Buttons)
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-36 rounded-xl border border-licorice/15 px-3 py-2 font-mono text-[13px] font-bold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-feldgrau">
                  Accent Color (Highlights & Badges)
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-36 rounded-xl border border-licorice/15 px-3 py-2 font-mono text-[13px] font-bold text-licorice shadow-sm focus:border-licorice focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky Save Bar ── */}
        <div className="sticky bottom-4 z-20 flex justify-end">
          <div className="rounded-2xl bg-white p-2 shadow-[0_12px_32px_rgba(35,20,12,0.15)] ring-1 ring-licorice/10 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-licorice px-6 py-3 text-[13px] font-bold text-khaki shadow-sm transition-all hover:bg-licorice/95 active:scale-95 disabled:opacity-70"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-khaki border-t-transparent" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" strokeWidth={2.5} />
                  <span>Save Brand & Tax Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
