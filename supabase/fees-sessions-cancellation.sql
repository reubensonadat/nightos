-- ═══════════════════════════════════════════════════════════════
-- NIGHTOS — PLATFORM FEES (CASH), ORDER CANCELLATION (WAITER ONLY),
--            20-MIN SESSION EXPIRY, MANAGER OUTSTANDING BALANCE
-- Run this ONCE in Supabase SQL Editor (copy all, paste, Run).
-- Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════
-- BUSINESS RULES:
-- 1. Online payments (MoMo/card via Paystack sub-account): NightOS
--    takes its fee automatically at the transaction. Nothing owed.
-- 2. Cash payments: we can't take the fee from the customer's hand,
--    so the fee (platform_fee) is stored on the payment and counts
--    towards the venue's OUTSTANDING BALANCE for the monthly invoice.
--    Fee = 1% of the bill, minimum 1.00, maximum 15.00 (GHS).
-- 3. Order cancellation is WAITER-ONLY (staff call the RPC).
-- 4. A QR session that lands but sends NO order within 20 minutes
--    is expired automatically (customer must re-scan to order).

-- ── 1. PLATFORM FEE ON PAYMENTS ────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS platform_fee numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS fee_settled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_fee_settled_idx
    ON public.payments (venue_id, fee_settled);

-- Fee formula: 1% of the bill, clamped between 1.00 and 15.00.
-- (When the pricing plan changes, edit the two numbers here.)
CREATE OR REPLACE FUNCTION public.platform_fee_for(p_amount numeric)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public AS $$
    SELECT GREATEST(1.00, LEAST(15.00, ROUND(p_amount * 0.01, 2)));
$$;

-- ── 2. CASH SETTLEMENT (waiter confirms the cash) ──────────────
-- Validates the staff member belongs to the venue, records the cash
-- payment WITH its platform fee (goes to outstanding balance), and
-- closes the bill when fully paid.
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_bill_id uuid,
    p_amount numeric,
    p_staff_id uuid,
    p_payer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
    v_new_paid numeric;
    v_status text;
    v_fee numeric;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'amount');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
    END IF;

    v_fee := public.platform_fee_for(p_amount);

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, payer_name,
        collected_by, status, platform_fee, fee_settled
    )
    VALUES (
        v_bill.id, v_bill.venue_id, p_amount, 'cash',
        'CASH-' || upper(substr(md5(random()::text), 1, 8)),
        p_payer_name, v_staff.id, 'success', v_fee, false
    );

    v_new_paid := v_bill.amount_paid + p_amount;
    IF v_new_paid >= v_bill.total - 0.005 THEN
        v_status := 'paid';
        UPDATE public.bills
        SET amount_paid = v_new_paid, status = 'paid', closed_at = now(), updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        v_status := 'settling';
        UPDATE public.bills
        SET amount_paid = v_new_paid, status = 'settling', updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'cash_payment_recorded', 'bill', v_bill.id::text,
            jsonb_build_object('amount', p_amount, 'platform_fee', v_fee, 'remaining', GREATEST(v_new_paid - v_bill.total, 0)));

    RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'bill_status', v_status,
                              'remaining', GREATEST(v_bill.total - v_new_paid, 0));
END;
$$;

-- ── 3. WAITER-ONLY ORDER CANCELLATION ──────────────────────────
-- Extends the existing staff status RPC with 'cancelled'. Only staff
-- of the same venue may cancel, and only orders not yet served.
CREATE OR REPLACE FUNCTION public.set_order_status(
    p_submission_id uuid, p_status text, p_staff_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_submission public.order_submissions%ROWTYPE;
    v_staff public.staff%ROWTYPE;
BEGIN
    IF p_status NOT IN ('confirmed', 'preparing', 'ready', 'served', 'cancelled') THEN
        RETURN false;
    END IF;

    SELECT * INTO v_submission
    FROM public.order_submissions WHERE id = p_submission_id LIMIT 1;
    IF NOT FOUND THEN RETURN false; END IF;

    IF p_status = 'cancelled' AND v_submission.status IN ('served', 'cancelled') THEN
        RETURN false;
    END IF;

    SELECT * INTO v_staff
    FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND OR v_submission.venue_id IS DISTINCT FROM v_staff.venue_id THEN
        RETURN false;
    END IF;

    UPDATE public.order_submissions
    SET status = p_status, updated_at = now()
    WHERE id = p_submission_id;

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_submission.venue_id, 'staff', v_staff.name,
            CASE WHEN p_status = 'cancelled' THEN 'order_cancelled' ELSE 'order_status_' || p_status END,
            'order_submission', v_submission.id::text,
            jsonb_build_object('from', v_submission.status, 'to', p_status));

    RETURN true;
END;
$$;

-- ── 4. 20-MINUTE SESSION EXPIRY ────────────────────────────────
-- Customers who scan a QR but send no order within 20 minutes lose
-- their session (they must re-scan to order). Waiter can see these
-- "landed but didn't order" sessions on the floor.
ALTER TABLE public.customer_sessions
    DROP CONSTRAINT IF EXISTS customer_sessions_status_check;

ALTER TABLE public.customer_sessions
    ADD CONSTRAINT customer_sessions_status_check
    CHECK (status IN ('active', 'closed', 'expired'));

CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Auto-run it every minute via pg_cron (if enabled on the project).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('nightos-expire-sessions', '* * * * *', 'SELECT public.expire_stale_sessions()');
    END IF;
END $$;

-- ── 5. MANAGER DASHBOARD HELPERS ───────────────────────────────
-- What the restaurant owes NightOS (fees on cash payments, unpaid).
CREATE OR REPLACE FUNCTION public.outstanding_balance(p_venue_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(SUM(platform_fee), 0)
    FROM public.payments
    WHERE venue_id = p_venue_id
      AND fee_settled = false
      AND status = 'success';
$$;

-- Sessions that landed but never ordered (waiters approach them).
CREATE OR REPLACE FUNCTION public.landed_without_orders(p_venue_id uuid)
RETURNS TABLE(
    session_id uuid, table_number int, table_label text,
    created_at timestamptz, age_minutes int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT cs.id, t.table_number, t.table_label, cs.created_at,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - cs.created_at)) / 60))::int
    FROM public.customer_sessions cs
    JOIN public.tables t ON t.id = cs.table_id
    WHERE cs.venue_id = p_venue_id
      AND cs.status = 'active'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      )
    ORDER BY cs.created_at;
$$;

-- Open bills per table (with merged-bill info for connected tables).
CREATE OR REPLACE FUNCTION public.open_bill_overview(p_venue_id uuid)
RETURNS TABLE(
    bill_id uuid, table_number int, table_label text, guests int,
    waiter_name text, total numeric, amount_paid numeric, age_minutes int,
    is_merged bool, merged_into_bill_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT b.id, t.table_number, t.table_label, b.guest_count,
           s.name, b.total, b.amount_paid,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - b.created_at)) / 60))::int,
           COALESCE(b.is_merged, false), b.merged_into_bill_id
    FROM public.bills b
    JOIN public.tables t ON t.id = b.table_id
    LEFT JOIN public.staff s ON s.id = b.waiter_id
    WHERE b.venue_id = p_venue_id
      AND b.status IN ('open', 'settling')
    ORDER BY b.created_at;
$$;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'payments' AND column_name IN ('platform_fee','fee_settled');
--   SELECT public.platform_fee_for(45), public.platform_fee_for(60), public.platform_fee_for(5000);
--     -- expect 1.00 | 1.00 | 15.00
--   SELECT public.expire_stale_sessions();
--   SELECT public.outstanding_balance((SELECT id FROM venues WHERE slug='velvet-lounge'));
-- ═══════════════════════════════════════════════════════════════
