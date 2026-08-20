export function computeBillTotal(
  subtotal: number,
  serviceChargePct: number,
  vatPct: number
): { subtotal: number; serviceCharge: number; vat: number; total: number } {
  const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100
  const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100
  const total = subtotal + serviceCharge + vat
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
