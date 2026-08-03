export function computeConvenienceFee(subtotal: number): number {
  if (subtotal <= 50)   return 1.00
  if (subtotal <= 100)  return 2.00
  if (subtotal <= 150)  return 3.00
  if (subtotal <= 200)  return 4.00
  return 5.00
}

export function computeBillTotal(
  subtotal: number,
  serviceChargePct: number,
  vatPct: number
): { subtotal: number; serviceCharge: number; vat: number; fee: number; total: number } {
  const fee = computeConvenienceFee(subtotal)
  const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100
  const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100
  const total = subtotal + serviceCharge + vat + fee
  return { subtotal, serviceCharge, vat, fee, total }
}

export type BillForVerification = {
  total: number
  payment_model: string | null
  convenience_fee: number | null
}

// Single source of truth for what a customer must pay, in pesewas.
// PREPAY bills: customer bears the convenience fee on top of the total.
// POSTPAY bills: customer pays exactly the bill total (venue absorbs the fee).
export function expectedBillAmountPesewas(bill: BillForVerification): number {
  return bill.payment_model === 'PREPAY'
    ? Math.round((bill.total + (bill.convenience_fee ?? 0)) * 100)
    : Math.round(bill.total * 100)
}
