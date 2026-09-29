export function computeBillTotal(
  subtotal: number,
  serviceChargePct: number = 0,
  vatPct: number = 0
): { subtotal: number; serviceCharge: number; vat: number; total: number } {
  const serviceCharge = 0
  const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100
  const total = subtotal + vat
  return { subtotal, serviceCharge, vat, total }
}

export type BillForVerification = {
  total: number
  amount_paid: number
}

// Single source of truth for what a customer must STILL pay, in pesewas.
// Remaining balance = total − Σ(success payments). The customer pays the
// remaining balance only — no convenience fee on top. This is what enables
// partial/split payments (SYSTEM_FLOW §4.2.2): each payment covers a slice,
// never the whole bill twice.
export function expectedBillAmountPesewas(bill: BillForVerification): number {
  const remaining = (bill.total ?? 0) - (bill.amount_paid ?? 0)
  return Math.round(Math.max(remaining, 0) * 100)
}

// 10% Platform Fee & Revenue Split Model:
// - Total Fee / Service Cut: 10% of transaction amount
// - Paystack Gateway Processing: 2% of transaction amount
// - NightOS / Bysen Net Revenue: 8% of transaction amount
// - Venue / Merchant Net Settlement: 90% of transaction amount
export type FeeSplit = {
  gross: number
  totalFee: number        // 10%
  paystackFee: number     // 2%
  netPlatformFee: number  // 8%
  venueSettlement: number // 90%
}

export function computeFeeSplit(
  amountGhs: number,
  feePct: number = 10,
  paystackPct: number = 2
): FeeSplit {
  const gross = Math.max(amountGhs, 0)
  const totalFee = Math.round(gross * (feePct / 100) * 100) / 100
  const paystackFee = Math.round(gross * (paystackPct / 100) * 100) / 100
  const netPlatformFee = Math.round((totalFee - paystackFee) * 100) / 100
  const venueSettlement = Math.round((gross - totalFee) * 100) / 100

  return { gross, totalFee, paystackFee, netPlatformFee, venueSettlement }
}

export function platformFeeFor(amountGhs: number, feePct: number = 10): number {
  const amount = Math.max(amountGhs, 0)
  return Math.round(amount * (feePct / 100) * 100) / 100
}

// Paystack's `channel` values → our `payments.method` enum
// ('mobile_money', 'card', 'bank_transfer', 'digital_wallet', 'cash').
// Correct mapping matters for reports (§4.2.9): mobile_money must never be
// bucketed as digital_wallet.
export function mapPaystackChannel(channel: string | undefined | null): string {
  switch (channel) {
    case 'card':
      return 'card'
    case 'bank':
    case 'bank_transfer':
      return 'bank_transfer'
    case 'mobile_money':
    case 'ussd':
      return 'mobile_money'
    case 'digital_wallet':
      return 'digital_wallet'
    default:
      return 'digital_wallet'
  }
}
