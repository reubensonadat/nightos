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
