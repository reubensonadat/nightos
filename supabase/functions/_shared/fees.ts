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
}

// Single source of truth for what a customer must pay, in pesewas.
// The customer pays exactly the bill total — no convenience fee.
export function expectedBillAmountPesewas(bill: BillForVerification): number {
  return Math.round(bill.total * 100)
}
