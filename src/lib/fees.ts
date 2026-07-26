export function computeConvenienceFee(subtotal: number): number {
  if (subtotal <= 50) return 1.0;
  if (subtotal <= 100) return 2.0;
  if (subtotal <= 150) return 3.0;
  if (subtotal <= 200) return 4.0;
  return 5.0;
}

export function computeBillTotal(
  subtotal: number,
  serviceChargePct: number,
  vatPct: number
): {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  fee: number;
  total: number;
} {
  const fee = computeConvenienceFee(subtotal);
  const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100;
  const vat = Math.round(subtotal * (vatPct / 100) * 100) / 100;
  const total = subtotal + serviceCharge + vat + fee;
  return { subtotal, serviceCharge, vat, fee, total };
}
