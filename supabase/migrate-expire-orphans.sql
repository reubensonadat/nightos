-- Fixed sweeper: also cancels ORPHAN bills (bills with NO linked session).
-- The old step 2 required a session link, so waiter/scan-created orphan bills
-- (like the 4 zombies on Table 1, idle 118h) were invisible forever.

CREATE OR REPLACE FUNCTION public.expire_stale_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count int;
BEGIN
    -- 1. Mark stale sessions expired (active, >20 min, no submissions)
    UPDATE public.customer_sessions cs
    SET status = 'expired', last_active_at = now()
    WHERE cs.status = 'active'
      AND cs.created_at < now() - interval '20 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_submissions os
          WHERE os.customer_session_id = cs.id
      );

    -- 2. Cancel ANY empty idle bill — session-linked or not:
    --    no order items, no successful payments, untouched for 20 minutes.
    UPDATE public.bills b
    SET status = 'cancelled', closed_at = now(), updated_at = now(), last_activity_at = now()
    WHERE b.status IN ('open', 'settling')
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.bill_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.bill_id = b.id AND p.status = 'success')
      AND b.last_activity_at < now() - interval '20 minutes';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;