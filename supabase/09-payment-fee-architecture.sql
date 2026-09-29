-- ═════════════════════════════════════════════════════════════════════════════
-- 09 — Payment Architecture: 10% Fee Split (2% Paystack / 8% Bysen / 90% Venue)
-- 
-- Why:
-- 1. Eliminates legacy ₵1, ₵2, ₵3, ₵4, ₵5+ tiered fee schedule.
-- 2. Establishes a transparent 10% total fee model:
--      • 2%  -> Paystack gateway processing (MoMo / Card gateway fee)
--      • 8%  -> NightOS / Bysen net software platform commission
--      • 90% -> Venue / Merchant net settlement
-- 3. Adds fee tracking columns to public.payments.
-- 4. Automates split calculation via database trigger on payment completion.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Ensure platform_fee_for computes flat 10%
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.10, 2)::numeric(10,2);
$$;

GRANT EXECUTE ON FUNCTION public.platform_fee_for(numeric) TO anon, authenticated, service_role;


-- 2. Add split accounting columns to public.payments
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS paystack_fee numeric(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_platform_fee numeric(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS venue_settlement numeric(10,2) DEFAULT 0;


-- 3. SQL helper function to calculate payment split
CREATE OR REPLACE FUNCTION public.compute_payment_split(p_amount numeric)
RETURNS TABLE (
    total_fee numeric,
    paystack_fee numeric,
    net_platform_fee numeric,
    venue_settlement numeric
)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT
        ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.10, 2)::numeric(10,2) AS total_fee,
        ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.02, 2)::numeric(10,2) AS paystack_fee,
        ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.08, 2)::numeric(10,2) AS net_platform_fee,
        ROUND(GREATEST(COALESCE(p_amount, 0), 0) * 0.90, 2)::numeric(10,2) AS venue_settlement;
$$;

GRANT EXECUTE ON FUNCTION public.compute_payment_split(numeric) TO anon, authenticated, service_role;


-- 4. Trigger to auto-populate split columns whenever a payment is inserted or updated
CREATE OR REPLACE FUNCTION public.fn_auto_compute_payment_fee_split()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.amount IS NOT NULL AND NEW.amount > 0 THEN
        -- 10% total service charge
        NEW.platform_fee := ROUND(NEW.amount * 0.10, 2);
        -- 2% Paystack gateway fee
        NEW.paystack_fee := ROUND(NEW.amount * 0.02, 2);
        -- 8% NightOS / Bysen net revenue
        NEW.net_platform_fee := ROUND(NEW.amount * 0.08, 2);
        -- 90% Net settlement to venue
        NEW.venue_settlement := NEW.amount - NEW.platform_fee;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_fee_split ON public.payments;
CREATE TRIGGER trg_payment_fee_split
BEFORE INSERT OR UPDATE OF amount ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_compute_payment_fee_split();


-- 5. Backfill existing payments with the 10% split
UPDATE public.payments
SET platform_fee = ROUND(amount * 0.10, 2),
    paystack_fee = ROUND(amount * 0.02, 2),
    net_platform_fee = ROUND(amount * 0.08, 2),
    venue_settlement = amount - ROUND(amount * 0.10, 2)
WHERE amount > 0 AND (venue_settlement IS NULL OR venue_settlement = 0);
