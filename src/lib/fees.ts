export function computeBillTotal(
  subtotal: number,
  vatPct: number = 0,
  taxInclusive: boolean = true
): {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  total: number;
} {
  const serviceCharge = 0;
  if (vatPct <= 0) {
    return { subtotal, serviceCharge, vat: 0, total: subtotal };
  }

  if (taxInclusive) {
    const net = Math.round((subtotal / (1 + vatPct / 100)) * 100) / 100;
    const vat = Math.round((subtotal - net) * 100) / 100;
    return { subtotal: net, serviceCharge, vat, total: subtotal };
  } else {
    const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    return { subtotal, serviceCharge, vat, total };
  }
}

// ── Tax-inclusive display (venue-configurable pricing) ──
export type VenueTaxConfig = {
  vat_pct?: number | null;
  tax_inclusive?: boolean | null;
  service_charge_pct?: number | null;
};

/** VAT gross-up rate in percent (0 when taxes don't apply). */
export function venueDisplayTaxPct(venue: VenueTaxConfig | null | undefined): number {
  if (!venue || !venue.tax_inclusive) return 0;
  return Math.max(venue.vat_pct ?? 0, 0);
}

/** Price a customer should SEE for a base-priced item (gross when inclusive). */
export function displayPrice(base: number, taxPct: number): number {
  if (taxPct <= 0) return base;
  return Math.round(base * (1 + taxPct / 100) * 100) / 100;
}

/**
 * Bysen Platform Fee Schedule:
 * - 0 to 50 GHS: 1.00 GHS
 * - 51 to 100 GHS: 2.00 GHS
 * - 101 to 150 GHS: 3.00 GHS
 * - 151 to 200 GHS: 4.00 GHS
 * - 200 to 500 GHS: 7.00 GHS
 * - 501 to 700 GHS: 12.00 GHS
 * - 701+ GHS: 15.00 GHS
 * Capped so fee never exceeds the bill amount.
 */
export function platformFeeFor(amountGhs: number): number {
  const amount = Math.max(amountGhs, 0);
  const tier =
    amount <= 50 ? 1.0 :
    amount <= 100 ? 2.0 :
    amount <= 150 ? 3.0 :
    amount <= 200 ? 4.0 :
    amount <= 500 ? 7.0 :
    amount <= 700 ? 12.0 : 15.0;
  return Math.round(Math.min(tier, amount) * 100) / 100;
}
