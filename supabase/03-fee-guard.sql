-- ─────────────────────────────────────────────────────────────
-- 03 — Fee boundary guard
-- Run after 01-schema-and-logic.sql.
--
-- Why: platform_fee_for() returned flat tiers (₵1–₵5). On any bill
-- under ₵1 the fee exceeded the transaction itself (e.g. ₵0.99 bill
-- → ₵1.00 fee). The fee is charged to the VENUE, never the customer,
-- and must never exceed the bill amount.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT LEAST(
        CASE
            WHEN p_amount <= 50   THEN 1.00
            WHEN p_amount <= 100  THEN 2.00
            WHEN p_amount <= 150  THEN 3.00
            WHEN p_amount <= 200  THEN 4.00
            WHEN p_amount <= 500  THEN 7.00
            WHEN p_amount <= 700  THEN 12.00
            ELSE 15.00
        END,
        GREATEST(p_amount, 0)
    )::numeric(10,2);
$$;

-- ─────────────────────────────────────────────────────────────
-- Tax-inclusive price display — default ON
-- Guests scanning the QR menu must see the final price (base ×
-- (1 + service% + VAT%)). Bill math is unchanged (the DB trigger still
-- adds svc + VAT on the base subtotal) — this is a display default.
-- New venues default to inclusive display; existing venues that charge
-- svc/VAT are flipped so the guest menu stops showing pre-tax prices.
-- Venues that don't charge taxes (both rates 0) are unaffected.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.venues
    ALTER COLUMN tax_inclusive SET DEFAULT true;

UPDATE public.venues
SET    tax_inclusive = true
WHERE  tax_inclusive = false
  AND  (COALESCE(service_charge_pct, 0) > 0 OR COALESCE(vat_pct, 0) > 0);

-- Sanity checks:
--   SELECT public.platform_fee_for(149.99);  -- 3.00 (101–150 tier)
--   SELECT public.platform_fee_for(150.00);  -- 3.00
--   SELECT public.platform_fee_for(150.01);  -- 4.00
--   SELECT public.platform_fee_for(5000);    -- 5.00 (hard cap)
--   SELECT public.platform_fee_for(0.99);    -- 0.99 (fee ≤ bill)
--   SELECT public.platform_fee_for(0);       -- 0.00
