export function computeBillTotal(
  subtotal: number,
  serviceChargePct: number,
  vatPct: number
): {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  total: number;
} {
  const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100;
  const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100;
  const total = subtotal + serviceCharge + vat;
  return { subtotal, serviceCharge, vat, total };
}

// ── Tax-inclusive display (venue-configurable pricing) ──
// When venues.tax_inclusive = true, customer-facing surfaces display the
// GROSS price (base × (1 + service% + VAT%)) so the price shown is the
// price paid. The authoritative math stays in the DB (recalculate_bill
// trigger adds svc + VAT on the base subtotal); this is display-only, so
// per-item rounding may drift ≤1 pesewa from the bill total — the bill
// remains the source of truth at checkout.
// Venues with service_charge_pct = 0 and vat_pct = 0 (e.g. small spots
// not registered for VAT) automatically show base prices everywhere.
export type VenueTaxConfig = {
  service_charge_pct: number;
  vat_pct: number;
  tax_inclusive: boolean;
};

/** Combined gross-up rate in percent (0 when taxes don't apply). */
export function venueDisplayTaxPct(venue: VenueTaxConfig | null | undefined): number {
  if (!venue || !venue.tax_inclusive) return 0;
  return Math.max(venue.service_charge_pct ?? 0, 0) + Math.max(venue.vat_pct ?? 0, 0);
}

/** Price a customer should SEE for a base-priced item (gross when inclusive). */
export function displayPrice(base: number, taxPct: number): number {
  if (taxPct <= 0) return base;
  return Math.round(base * (1 + taxPct / 100) * 100) / 100;
}
