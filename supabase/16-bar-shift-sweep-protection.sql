-- ═══════════════════════════════════════════════════════════════════════════
-- 16 — BAR-SHIFT SWEEP PROTECTION: ending a bar shift must not close tabs
--       that carry money, and terminal bill statuses must stay terminal.
--
-- Incident (2026-10-03, Memories Night Club): VIP guest paid the GH₵ 2,000
-- deposit, ordered nothing — and the table vanished from the waiter and
-- manager dashboards. handle_bar_station_shift_end() (trigger on
-- bar_station_shifts) force-closed ALL open/settling bills venue-wide when a
-- bar shift ended, with no money guard. recalculate_single_bill() then
-- rewrote status 'closed' → 'settling' on later triggers while closed_at
-- stayed set — and every dashboard filters closed_at IS NULL, so the table
-- was invisible no matter how many times the page was refreshed.
--
-- Fixes:
--   A. Shift-end sweep skips bills carrying money (deposit paid, credit
--      remaining, partial payment, any successful payment). Zero-money
--      walk-in tabs are still swept at shift end, as designed.
--   B. Sessions tied to money bills are no longer force-closed either.
--   C. recalculate_single_bill treats 'cancelled' and 'closed' as terminal —
--      it can no longer resurrect or demote them — and clears the leftover
--      closed_at that the old "instant paid" bug stamped onto live bills.
--   D. bill_auto_close_on_payment no longer marks a bill paid when its total
--      is 0.00 — that is what "paid + closed" every deposit table the moment
--      the deposit landed (2,000 >= 0), making it invisible everywhere.
--   E. Sweep writes status 'cancelled' (legal per bills_status_check) — the
--      old sweep wrote 'closed', an illegal value whose UPDATE always failed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A + B. Money-guarded bar-shift end sweep ──
CREATE OR REPLACE FUNCTION public.handle_bar_station_shift_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') THEN
        -- Close active customer sessions that do NOT own a money-carrying bill
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

        -- Close open / settling bills that carry NO money.
        -- Tabs with deposits, credit or payments survive the shift end —
        -- staff must settle them explicitly (waiter invoice / manager).
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
    END IF;
    RETURN NEW;
END;
$$;

-- ── C. recalculate_single_bill: terminal statuses stay terminal ──
--    (supersedes migration 15's copy; adds only the cancelled/closed branch)
CREATE OR REPLACE FUNCTION public.recalculate_single_bill(p_bill_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_subtotal numeric(10,2);
    v_sc_pct   numeric;
    v_vat_pct  numeric;
    v_tax_incl boolean;
    v_service  numeric(10,2) := 0;
    v_vat      numeric(10,2) := 0;
    v_total    numeric(10,2) := 0;
    v_paid     numeric(10,2) := 0;
    v_dep_paid boolean := false;
    v_dep      numeric(10,2) := 0;
    v_status   text;
BEGIN
    SELECT COALESCE(SUM(oi.line_total), 0) INTO v_subtotal
    FROM public.order_items oi
    JOIN public.order_submissions os ON os.id = oi.submission_id
    WHERE oi.bill_id = p_bill_id
      AND COALESCE(oi.status, 'confirmed') != 'cancelled'
      AND COALESCE(os.status, 'confirmed') != 'cancelled';

    SELECT v.service_charge_pct, v.vat_pct, COALESCE(v.tax_inclusive, false)
      INTO v_sc_pct, v_vat_pct, v_tax_incl
    FROM public.bills b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = p_bill_id;

    v_service := ROUND(COALESCE(v_subtotal, 0) * COALESCE(v_sc_pct, 0) / 100.0, 2);

    IF COALESCE(v_vat_pct, 0) > 0 THEN
        IF v_tax_incl THEN
            v_vat   := ROUND(v_subtotal - (v_subtotal / (1 + v_vat_pct / 100.0)), 2);
            v_total := v_subtotal + v_service;
        ELSE
            v_vat   := ROUND(v_subtotal * v_vat_pct / 100.0, 2);
            v_total := v_subtotal + v_service + v_vat;
        END IF;
    ELSE
        v_total := v_subtotal + v_service;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = p_bill_id AND status = 'success';

    SELECT COALESCE(deposit_paid, false), COALESCE(deposit_amount, 0), status
      INTO v_dep_paid, v_dep, v_status
    FROM public.bills
    WHERE id = p_bill_id;

    UPDATE public.bills
    SET subtotal = COALESCE(v_subtotal, 0),
        convenience_fee = 0.00,
        service_charge = v_service,
        vat = v_vat,
        total = v_total,
        amount_paid = v_paid,
        remaining_credit = CASE
            WHEN v_dep_paid THEN GREATEST(v_dep - v_total, 0)
            ELSE 0
        END,
        status = CASE
            WHEN v_status IN ('cancelled', 'closed') THEN v_status
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            WHEN v_status = 'paid' AND v_paid < (v_total - 0.01) THEN 'open'
            ELSE v_status
        END,
        closed_at = CASE
            WHEN v_status IN ('cancelled', 'closed') THEN closed_at
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0 THEN now()
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_single_bill(uuid) TO anon, authenticated, service_role;

-- ── D. Payments can no longer "pay off" a zero-total bill ──
--    The deposit lands (2,000) on an empty bill (total 0.00); the old
--    trigger computed 2000 >= 0 - 0.005 and stamped status='paid',
--    closed_at=now() — killing the table the instant the guest paid the
--    deposit. A bill is only auto-closed when it actually has a total.
CREATE OR REPLACE FUNCTION public.bill_auto_close_on_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_paid numeric;
BEGIN
    IF NEW.status <> 'success' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = NEW.bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE bill_id = NEW.bill_id AND status = 'success';

    IF v_bill.total > 0 AND v_paid >= v_bill.total - 0.005 THEN
        UPDATE public.bills
        SET amount_paid = v_paid, status = 'paid', closed_at = now(), updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET amount_paid = v_paid, status = 'settling', updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    RETURN NEW;
END;
$$;

-- ═══ DATA REPAIR (run after this migration) ═══
-- Reopen today's live deposit bill (the table the guest is sitting at):
--   UPDATE public.bills
--      SET status = 'settling', closed_at = NULL, updated_at = now(), last_activity_at = now()
--    WHERE id = '38418bdf-9289-4d8f-bf84-6a84f759f4f6';
-- Terminal-close the stale morning test bills (closed_at stays, status was
-- demoted to 'settling' by the old recalc):
--   UPDATE public.bills SET status = 'closed', updated_at = now()
--    WHERE id IN ('ec949a52-07a8-4ff5-bd97-f6b1e9a172f7',
--                 'b70d6b6b-87e7-4035-8b29-9b0af2424a50');
--
-- VERIFY: end a bar shift while the deposit table is open — the bill must
-- keep status 'settling' and closed_at NULL:
--   SELECT status, closed_at, deposit_paid, amount_paid FROM public.bills
--    WHERE id = '38418bdf-9289-4d8f-bf84-6a84f759f4f6';
