-- ============================================================
-- NIGHTOS MIGRATION — Session close + expiry cleanup
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Covers:
--   1. expire_stale_sessions() v2: when a session expires (20 min,
--      no orders), its orphaned EMPTY bill is cancelled too, so the
--      table frees up on the manager/waiter views automatically.
--   2. close_bill(): staff RPC that closes a table — cancels the
--      open bill (no successful payments), closes its sessions,
--      cancels pending submissions, logs to activity_logs.
--   3. Kitchen read policies: served/cancelled are included so the
--      customer's realtime feed can deliver those final statuses
--      (this is what lets us remove the 12-second poll).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. SESSION EXPIRY ALSO CANCELS THE ORPHANED EMPTY BILL
-- ────────────────────────────────────────────────────────────
-- An expired session is guaranteed to have zero order submissions,
-- so its bill is always empty (no items, no payments). Cancelling
-- it here frees the table for the next guest automatically.
CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count int;
BEGIN
    -- 1. Mark stale sessions expired (unchanged rule: active, >20 min, no orders)
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 2. Cancel the orphaned bill of any expired session, but only if it
    --    really is empty (no items, no successful payments) and still open.
    UPDATE public.bills b
    SET status = 'cancelled', closed_at = now(), updated_at = now()
    WHERE b.status IN ('open', 'settling')
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.bill_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.bill_id = b.id AND p.status = 'success')
      AND EXISTS (
          SELECT 1 FROM public.customer_sessions cs
          WHERE cs.bill_id = b.id AND cs.status = 'expired'
      );

    RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. CLOSE BILL (waiter closes a table)
-- ────────────────────────────────────────────────────────────
-- Any active staff member of the same venue can close a table:
--   - bill must be open/settling with NO successful payments
--   - bill → cancelled, its sessions → closed, pending items → cancelled
CREATE OR REPLACE FUNCTION public.close_bill(
    p_bill_id uuid,
    p_staff_id uuid
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

-- ────────────────────────────────────────────────────────────
-- 3. KITCHEN READ POLICIES INCLUDE served/cancelled
-- ────────────────────────────────────────────────────────────
-- Matches setup-all.sql (A2). This is what lets the customer's
-- realtime subscription (anonymous, no token) see the final
-- served/cancelled statuses, removing the need for the 12s poll.
DROP POLICY IF EXISTS "Kitchen reads active submissions" ON public.order_submissions;
CREATE POLICY "Kitchen reads active submissions" ON public.order_submissions
    FOR SELECT USING (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'));

DROP POLICY IF EXISTS "Kitchen reads order items" ON public.order_items;
CREATE POLICY "Kitchen reads order items" ON public.order_items
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')
        )
    );

DROP POLICY IF EXISTS "Kitchen reads bills" ON public.bills;
CREATE POLICY "Kitchen reads bills" ON public.bills
    FOR SELECT USING (
        id IN (
            SELECT bill_id FROM public.order_submissions
            WHERE status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled')
        )
    );

-- ────────────────────────────────────────────────────────────
-- 4. VERIFICATION
-- ────────────────────────────────────────────────────────────

-- Both functions exist:
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('expire_stale_sessions', 'close_bill');

-- Kitchen policy includes served/cancelled (expect a row with the full list):
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'order_submissions'
  AND policyname = 'Kitchen reads active submissions';
