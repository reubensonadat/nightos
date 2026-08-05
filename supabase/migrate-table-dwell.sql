-- ============================================================
-- NIGHTOS MIGRATION — Table dwell-time tracking
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Problem: a bill open for hours (or idle for hours) had no
-- signal anywhere. Only the 20-min no-order session expiry
-- existed. Staff had to eyeball "X min open" in LiveOps.
--
-- Covers:
--   1. bills.last_activity_at — touched by trigger whenever an
--      order item or payment is inserted/updated/deleted on the
--      bill (incl. after merge/split, which move items).
--   2. open_bill_overview() v2 — now also returns last_activity_at
--      and dwell_minutes (minutes since last activity).
--   3. get_venue_setting() — SECURITY DEFINER reader for venue
--      settings (max_dwell_minutes, default 120) so staff devices
--      (anon) and the manager can both read it under RLS.
--
-- The threshold is enforced only in the UI (waiter table cards,
-- manager LiveOps alerts). Nothing is auto-cancelled here.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. bills.last_activity_at
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.bills
    ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill: the best available "last activity" for existing bills is
-- the newest order item or payment on the bill, else when it opened.
UPDATE public.bills b
SET last_activity_at = GREATEST(
        b.created_at,
        COALESCE((SELECT MAX(oi.created_at) FROM public.order_items oi WHERE oi.bill_id = b.id), b.created_at),
        COALESCE((SELECT MAX(p.created_at) FROM public.payments p WHERE p.bill_id = b.id), b.created_at)
    )
WHERE b.last_activity_at IS NULL;

ALTER TABLE public.bills
    ALTER COLUMN last_activity_at SET DEFAULT now(),
    ALTER COLUMN last_activity_at SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Touch triggers (order_items + payments)
-- ────────────────────────────────────────────────────────────
-- Any change to a bill's items or payments resets the dwell clock.
-- Merge/split re-point order_items → fires automatically.
CREATE OR REPLACE FUNCTION public.touch_bill_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill_id uuid;
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
    IF v_bill_id IS NOT NULL THEN
        UPDATE public.bills
        SET last_activity_at = now(), updated_at = now()
        WHERE id = v_bill_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_activity_items ON public.order_items;
CREATE TRIGGER trg_bill_activity_items
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_bill_activity();

DROP TRIGGER IF EXISTS trg_bill_activity_payments ON public.payments;
CREATE TRIGGER trg_bill_activity_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.touch_bill_activity();

-- ────────────────────────────────────────────────────────────
-- 3. open_bill_overview() v2 — add last_activity_at + dwell_minutes
-- ────────────────────────────────────────────────────────────
-- Return type changed → drop first (Postgres refuses CREATE OR
-- REPLACE across a return-type change).
DROP FUNCTION IF EXISTS public.open_bill_overview(p_venue_id uuid);

CREATE OR REPLACE FUNCTION public.open_bill_overview(p_venue_id uuid)
RETURNS TABLE(
    bill_id uuid, table_number int, table_label text, guests int,
    waiter_name text, total numeric, amount_paid numeric, age_minutes int,
    last_activity_at timestamptz, dwell_minutes int,
    is_merged bool, merged_into_bill_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT b.id, t.table_number, t.table_label, b.guest_count,
           s.name, b.total, b.amount_paid,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.created_at)) / 60))::int,
           b.last_activity_at,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.last_activity_at)) / 60))::int,
           COALESCE(b.is_merged, false), b.merged_into_bill_id
    FROM public.bills b
    JOIN public.tables t ON t.id = b.table_id
    LEFT JOIN public.staff s ON s.id = b.waiter_id
    WHERE b.venue_id = p_venue_id
      AND b.status IN ('open', 'settling')
    ORDER BY b.created_at;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. get_venue_setting() — staff-safe venue setting reader
-- ────────────────────────────────────────────────────────────
-- venue_settings RLS is owner-only; waiter devices run as anon,
-- so a SECURITY DEFINER reader is the clean way to share the
-- dwell threshold. Default JSON falls back when the key is unset.
CREATE OR REPLACE FUNCTION public.get_venue_setting(
    p_venue_id uuid,
    p_key text,
    p_default jsonb DEFAULT 'null'::jsonb
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT value FROM public.venue_settings WHERE venue_id = p_venue_id AND key = p_key),
        p_default
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_setting(uuid, text, jsonb) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. SET THE DEFAULT THRESHOLD (idempotent)
-- ────────────────────────────────────────────────────────────
-- max_dwell_minutes: minutes a bill may be idle before it flags.
-- 120 = 2 hours. Owners can change it in the manager UI later
-- (or here):  key = 'max_dwell_minutes', value = <number>.
INSERT INTO public.venue_settings (venue_id, key, value)
SELECT v.id, 'max_dwell_minutes', '120'::jsonb
FROM public.venues v
ON CONFLICT (venue_id, key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. VERIFICATION
-- ────────────────────────────────────────────────────────────

-- Column + triggers exist:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bills'
  AND column_name = 'last_activity_at';

SELECT tgname FROM pg_trigger
WHERE tgname IN ('trg_bill_activity_items', 'trg_bill_activity_payments');

-- Functions exist:
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('open_bill_overview', 'get_venue_setting');

-- Smoke test (expect a dwell_minutes column):
-- SELECT bill_id, age_minutes, dwell_minutes, last_activity_at
-- FROM public.open_bill_overview((SELECT id FROM venues WHERE slug='velvet-lounge'))
-- LIMIT 5;
