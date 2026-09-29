export function computeBillTotal(
  subtotal: number,
  vatPct: number = 0,
  taxInclusive: boolean = true,
  serviceChargePct: number = 10
): {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  total: number;
} {
  const serviceCharge = Math.round(subtotal * (Math.max(serviceChargePct, 0) / 100) * 100) / 100;

  if (vatPct <= 0) {
    return {
      subtotal,
      serviceCharge,
      vat: 0,
      total: Math.round((subtotal + serviceCharge) * 100) / 100,
    };
  }

  if (taxInclusive) {
    const net = Math.round((subtotal / (1 + vatPct / 100)) * 100) / 100;
    const vat = Math.round((subtotal - net) * 100) / 100;
    return {
      subtotal: net,
      serviceCharge,
      vat,
      total: Math.round((subtotal + serviceCharge) * 100) / 100,
    };
  } else {
    const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100;
    const total = Math.round((subtotal + serviceCharge + vat) * 100) / 100;
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
 * 10% Service Charge / Platform Fee:
 * Replaced the 1, 2, 3, 4, 5+ tiered fee schedule with a flat 10% charge.
 */
export function platformFeeFor(amountGhs: number, serviceChargePct: number = 10): number {
  const amount = Math.max(amountGhs, 0);
  return Math.round(amount * (serviceChargePct / 100) * 100) / 100;
}
