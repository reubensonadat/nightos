export function computeBillTotal(
  subtotal: number,
  vatPct: number = 0,
  taxInclusive: boolean = true,
  serviceChargePct: number = 0
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

/** VAT gross-up rate in percent (0 when taxes don't apply). In modern architecture, menu prices in DB are authoritative and never artificially marked up. */
export function venueDisplayTaxPct(_venue: VenueTaxConfig | null | undefined): number {
  return 0;
}

/** Price a customer should SEE for a base-priced item (returns base price without artificial markup). */
export function displayPrice(base: number, _taxPct?: number): number {
  return base;
}

/**
 * 10% Service Charge / Platform Fee:
 * Replaced the 1, 2, 3, 4, 5+ tiered fee schedule with a flat 10% charge.
 */
export function platformFeeFor(amountGhs: number, serviceChargePct: number = 10): number {
  const amount = Math.max(amountGhs, 0);
  return Math.round(amount * (serviceChargePct / 100) * 100) / 100;
}

/**
 * 10% Revenue & Settlement Split:
 * - 10% Total Fee
 * - 2% Paystack Processing
 * - 8% NightOS / Bysen Net Platform Share
 * - 90% Venue / Merchant Net Settlement
 */
export type FeeSplit = {
  gross: number;
  totalFee: number;        // 10%
  paystackFee: number;     // 2%
  netPlatformFee: number;  // 8%
  venueSettlement: number; // 90%
};

export function computeFeeSplit(
  amountGhs: number,
  feePct: number = 10,
  paystackPct: number = 2
): FeeSplit {
  const gross = Math.max(amountGhs, 0);
  const totalFee = Math.round(gross * (feePct / 100) * 100) / 100;
  const paystackFee = Math.round(gross * (paystackPct / 100) * 100) / 100;
  const netPlatformFee = Math.round((totalFee - paystackFee) * 100) / 100;
  const venueSettlement = Math.round((gross - totalFee) * 100) / 100;

  return { gross, totalFee, paystackFee, netPlatformFee, venueSettlement };
}

/**
 * Dynamic Paystack Fee Allocation with 90% Hard Cap:
 * Recovers unpaid cash fee debts from subsequent online transactions.
 * Total deduction on this transaction can never exceed 90% of gross.
 */
export type DynamicPaystackSplit = {
  gross: number;
  standardFee: number;       // 10% standard platform fee
  outstandingDebt: number;   // previous fee debt owed by venue
  debtClawback: number;      // recovered from this transaction
  totalFee: number;          // standardFee + debtClawback (<= 90% of gross)
  venueNet: number;          // at least 10% guaranteed to venue
  transactionChargePesewas: number; // for Paystack Inline setup
};

export function calculateDynamicPaystackSplit(
  amountGhs: number,
  outstandingDebtGhs: number = 0
): DynamicPaystackSplit {
  const gross = Math.max(amountGhs, 0);
  const standardFee = Math.round(gross * 0.10 * 100) / 100;
  const maxTotalDeduction = Math.round(gross * 0.90 * 100) / 100;
  const debtHeadroom = Math.max(0, maxTotalDeduction - standardFee); // 80% of gross
  const debtClawback = Math.round(Math.min(Math.max(0, outstandingDebtGhs), debtHeadroom) * 100) / 100;
  const totalFee = Math.round((standardFee + debtClawback) * 100) / 100;
  const venueNet = Math.round((gross - totalFee) * 100) / 100;

  return {
    gross,
    standardFee,
    outstandingDebt: outstandingDebtGhs,
    debtClawback,
    totalFee,
    venueNet,
    transactionChargePesewas: Math.round(totalFee * 100),
  };
}

/**
 * Table Deposit & Consumable Credit Ledger:
 * - Upfront Minimum Spend Deposit paid (e.g. GH₵ 2,000 via Paystack).
 * - Drinks, food, and active orders deduct from this deposit credit balance.
 * - Remaining Credit is shown to guest while balance > 0 (bill due = 0).
 * - When credit is exhausted, subsequent orders accumulate as excess payable bill.
 * - Cancelled orders are strictly excluded.
 */
export type BillDepositBreakdown = {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  grossConsumed: number;
  depositAmount: number;
  depositPaid: boolean;
  remainingCredit: number;
  amountDue: number;
  isExhausted: boolean;
};

export function computeBillWithDeposit(
  grossItems: number,
  depositAmount: number = 0,
  depositPaid: boolean = false,
  vatPct: number = 0,
  taxInclusive: boolean = true,
  serviceChargePct: number = 0
): BillDepositBreakdown {
  const serviceCharge = Math.round(grossItems * (Math.max(serviceChargePct, 0) / 100) * 100) / 100;
  let subtotal = grossItems;
  let vat = 0;

  if (vatPct > 0) {
    if (taxInclusive) {
      subtotal = Math.round((grossItems / (1 + vatPct / 100)) * 100) / 100;
      vat = Math.round((grossItems - subtotal) * 100) / 100;
    } else {
      vat = Math.round(grossItems * (vatPct / 100) * 100) / 100;
    }
  }

  const grossConsumed = taxInclusive
    ? Math.round((grossItems + serviceCharge) * 100) / 100
    : Math.round((subtotal + serviceCharge + vat) * 100) / 100;

  const validDeposit = depositPaid ? Math.max(depositAmount, 0) : 0;
  const remainingCredit = Math.max(0, Math.round((validDeposit - grossConsumed) * 100) / 100);
  const amountDue = Math.max(0, Math.round((grossConsumed - validDeposit) * 100) / 100);
  const isExhausted = validDeposit > 0 && remainingCredit === 0;

  return {
    subtotal,
    serviceCharge,
    vat,
    grossConsumed,
    depositAmount: validDeposit,
    depositPaid,
    remainingCredit,
    amountDue,
    isExhausted,
  };
}
