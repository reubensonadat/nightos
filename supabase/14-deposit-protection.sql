-- ═══════════════════════════════════════════════════════════════════════════
-- 14 — DEPOSIT PROTECTION: a bill with money on it can never be auto-killed
--
-- Incident (2026-10-02, Memories Night Club): VIP guest paid GH₵ 2,000 table
-- deposit, ordered nothing, and 20 minutes later expire_stale_sessions()
-- cancelled the bill — destroying the credit and demanding a second deposit.
--
-- Root causes fixed here:
--   A. payments.reference had NO unique index on the live DB and method
--      'paystack' violated the method CHECK → recordDepositPayment() insert
--      threw → deposit survived only via the setBillDeposit fallback, leaving
--      ZERO payments rows → the reaper saw an "empty" bill and cancelled it.
--   B. expire_stale_sessions() / close_bill() ignored deposit_paid,
--      remaining_credit and amount_paid — money was invisible to them.
--
-- New rule: deposit_paid = true OR remaining_credit > 0 OR amount_paid > 0
-- OR any successful payment ⇒ the session is never expired and the bill is
-- never auto-cancelled. Idle expiry applies ONLY to zero-money walk-ins.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. payments.reference: unique (idempotent upserts + webhook dedupe) ──
CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_uidx
    ON public.payments (reference)
    WHERE reference IS NOT NULL;

-- ── 2. payments.method: allow 'paystack' (generic channel label used by the
--       VIP deposit flow; also correctly triggers the 2% paystack_fee split) ──
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_method_check
    CHECK (method IN ('mobile_money', 'card', 'bank_transfer', 'digital_wallet', 'cash', 'paystack'));

-- ── 3. expire_stale_sessions: money guards on both steps ──
CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count int;
BEGIN
    -- 1. Mark stale sessions expired (active, >20 min, no orders) —
    --    UNLESS their bill carries money (deposit paid, credit remaining,
    --    partial payment, or any successful payment). Money keeps the
    --    session alive until the tab is settled or a human intervenes.
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.bills b
          WHERE b.id = cs.bill_id
            AND (
                b.deposit_paid = true
                OR COALESCE(b.remaining_credit, 0) > 0
                OR COALESCE(b.amount_paid, 0) > 0
                OR EXISTS (SELECT 1 FROM public.payments p
                           WHERE p.bill_id = b.id AND p.status = 'success')
            )
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 2. Cancel the orphaned bill of any expired session — but ONLY if it is
    --    truly worthless: no items, no successful payments, no deposit,
    --    no remaining credit, nothing paid.
    UPDATE public.bills b
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE b.status IN ('open', 'settling')
      AND b.deposit_paid = false
      AND COALESCE(b.remaining_credit, 0) = 0
      AND COALESCE(b.amount_paid, 0) = 0
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.bill_id = b.id)
      AND NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.bill_id = b.id AND p.status = 'success'
      )
      AND EXISTS (
          SELECT 1 FROM public.customer_sessions cs
          WHERE cs.bill_id = b.id AND cs.status = 'expired'
      );

    RETURN v_count;
END;
$$;

-- ── 4. close_bill: staff cannot cancel a bill that holds money either.
--       Refunding a deposit is a manager/Paystack action, not a table-free. ──
CREATE OR REPLACE FUNCTION public.close_bill(
    p_bill_id uuid,
    p_staff_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_staff public.staff%ROWTYPE;
BEGIN
    SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
    IF NOT FOUND THEN RETURN false; END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.venue_id IS DISTINCT FROM v_staff.venue_id THEN
        RETURN false;
    END IF;

    IF v_bill.status NOT IN ('open', 'settling') THEN
        RETURN false;
    END IF;

    -- Money guard: deposit paid, credit remaining, or partial payment ⇒ refuse.
    IF v_bill.deposit_paid = true
       OR COALESCE(v_bill.remaining_credit, 0) > 0
       OR COALESCE(v_bill.amount_paid, 0) > 0 THEN
        RETURN false;
    END IF;

    IF EXISTS (SELECT 1 FROM public.payments p WHERE p.bill_id = p_bill_id AND p.status = 'success') THEN
        RETURN false;
    END IF;

    UPDATE public.bills
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE id = p_bill_id;

    UPDATE public.customer_sessions
    SET status = 'closed', last_active_at = now()
    WHERE bill_id = p_bill_id AND status IN ('active', 'expired');

    UPDATE public.order_submissions
    SET status = 'cancelled', updated_at = now()
    WHERE bill_id = p_bill_id AND status IN ('pending', 'confirmed', 'preparing');

    INSERT INTO public.activity_logs (venue_id, actor_type, actor_name, action, entity_type, entity_id, details)
    VALUES (v_bill.venue_id, 'staff', v_staff.name, 'bill_closed', 'bill', p_bill_id::text,
            jsonb_build_object('subtotal', v_bill.subtotal, 'table_id', v_bill.table_id));

    RETURN true;
END;
$$;

-- ═══ VERIFY ═══
-- 1) The incident bill must now be immune (run the recovery UPDATE first —
--    see ops notes — then):
--    SELECT status, deposit_paid, remaining_credit FROM public.bills
--     WHERE id = '08474179-b48e-486a-a95f-212fe0fbc208';   -- must stay 'open'
-- 2) Force the reaper and confirm it returns 0 for money-carrying tables:
--    SELECT public.expire_stale_sessions();
-- 3) Constraint landed:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'public.payments'::regclass
--     AND conname = 'payments_method_check';
--    SELECT indexname FROM pg_indexes
--     WHERE tablename = 'payments' AND indexname = 'payments_reference_uidx';
