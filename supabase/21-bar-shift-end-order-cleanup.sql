-- ═════════════════════════════════════════════════════════════════════════════
-- 21 — Bar Station Shift End: Clean up pending/unserved orders and sessions
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_bar_station_shift_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') THEN
        -- 1. Close active customer sessions that do NOT own a money-carrying bill
        UPDATE public.customer_sessions cs
        SET status = 'closed', closed_at = now(), last_active_at = now()
        WHERE cs.venue_id = NEW.venue_id
          AND cs.status = 'active'
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

        -- 2. Close open / settling bills that carry NO money.
        UPDATE public.bills b
        SET status = 'cancelled', closed_at = now(), updated_at = now()
        WHERE b.venue_id = NEW.venue_id
          AND b.status IN ('open', 'settling')
          AND b.closed_at IS NULL
          AND b.deposit_paid = false
          AND COALESCE(b.remaining_credit, 0) = 0
          AND COALESCE(b.amount_paid, 0) = 0
          AND NOT EXISTS (
              SELECT 1 FROM public.payments p
              WHERE p.bill_id = b.id AND p.status = 'success'
          );

        -- 3. Cancel any lingering unserved order submissions for closed / cancelled bills
        UPDATE public.order_submissions os
        SET status = 'cancelled', updated_at = now()
        WHERE os.venue_id = NEW.venue_id
          AND os.status IN ('pending', 'confirmed', 'preparing', 'ready')
          AND EXISTS (
              SELECT 1 FROM public.bills b
              WHERE b.id = os.bill_id
                AND b.status IN ('cancelled', 'closed')
          );
    END IF;
    RETURN NEW;
END;
$$;
