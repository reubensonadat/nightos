-- ═══════════════════════════════════════════════════════════════════════════
-- 17 — DEPOSIT CREDIT GUARD: unspent deposit credit keeps a bill alive.
--
-- Incident (2026-10-03 14:46, Memories Night Club): VIP guest paid the
-- GH₵ 2,000 deposit, ordered GH₵ 609.00 (bill total 669.90) — and the
-- instant the orders landed, recalculate_single_bill() computed
-- v_paid (2,000) >= total (669.90) and stamped status='paid',
-- closed_at=now() — killing the tab MID-VISIT with GH₵ 1,330.10 of
-- unspent credit. The app then spawned a fresh empty bill on the same
-- table (new table_pin), so the guest was dumped back on the deposit /
-- unlock screen with "everything cleared" and a table code that no
-- longer matched (table_pin is per-BILL, regenerated on every new bill).
--
-- Migration 16 fixed the total = 0.00 variant (deposit >= 0). This one
-- fixes the total > 0 variant: when a deposit covers the running total,
-- the bill is NOT finished — the guest is still spending their credit.
--
-- Rule added to ALL three auto-close paths:
--   never auto-close a bill while (deposit_paid AND deposit - total > 0)
-- Closing a credit-carrying bill is an explicit act only (waiter invoice
-- settlement / free-table / manager). Auto-close still fires when the
-- guest outspends the deposit and pays the excess at checkout (credit
-- is then 0 and the guard passes) — which is the correct moment.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. recalculate_single_bill: deposit-covered totals stay 'settling' ──
--    (supersedes migration 16's copy; adds only the credit guard)
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
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0
                 AND NOT (v_dep_paid AND (v_dep - v_total) > 0.005) THEN 'paid'
            WHEN v_paid > 0 THEN 'settling'
            WHEN v_status = 'paid' AND v_paid < (v_total - 0.01) THEN 'open'
            ELSE v_status
        END,
        closed_at = CASE
            WHEN v_status IN ('cancelled', 'closed') THEN closed_at
            WHEN v_paid >= (v_total - 0.01) AND v_total > 0
                 AND NOT (v_dep_paid AND (v_dep - v_total) > 0.005) THEN now()
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_single_bill(uuid) TO anon, authenticated, service_role;

-- ── B. bill_auto_close_on_payment: deposit payments can only 'settle' ──
--    Same guard as A: a payment that lands on a bill whose deposit still
--    covers the total moves it to 'settling' — never to 'paid'.
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

    IF v_bill.total > 0
       AND v_paid >= v_bill.total - 0.005
       AND NOT (COALESCE(v_bill.deposit_paid, false)
                AND (COALESCE(v_bill.deposit_amount, 0) - v_bill.total) > 0.005) THEN
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

-- ── C. record_cash_payment: partial cash cannot kill a credit tab ──
--    (full replacement; signature keeps the DEFAULTs — see migration 14's
--     42P13 lesson. Only the paid branch changed.)
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_bill_id uuid,
    p_amount numeric,
    p_staff_id uuid DEFAULT NULL,
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
    v_collected_by uuid := NULL;
    v_staff_name text := 'Staff';
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'amount');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND OR v_bill.status NOT IN ('open', 'settling') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_open');
    END IF;

    IF p_staff_id IS NOT NULL THEN
        SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND is_active = true LIMIT 1;
        IF FOUND THEN
            IF v_staff.venue_id IS DISTINCT FROM v_bill.venue_id THEN
                RETURN jsonb_build_object('ok', false, 'error', 'staff_venue_mismatch');
            END IF;
            v_collected_by := v_staff.id;
            v_staff_name := v_staff.name;
        ELSE
            -- Check if it's the venue owner / manager
            IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_bill.venue_id AND owner_id = p_staff_id) THEN
                IF v_bill.waiter_id IS NOT NULL THEN
                    SELECT * INTO v_staff FROM public.staff WHERE id = v_bill.waiter_id LIMIT 1;
                    IF FOUND THEN
                        v_collected_by := v_staff.id;
                        v_staff_name := v_staff.name;
                    END IF;
                END IF;
            ELSE
                v_staff_name := 'Owner';
            END IF;
        END IF;
    ELSIF v_bill.waiter_id IS NOT NULL THEN
        SELECT * INTO v_staff FROM public.staff WHERE id = v_bill.waiter_id LIMIT 1;
        IF FOUND THEN
            v_collected_by := v_staff.id;
            v_staff_name := v_staff.name;
        END IF;
    END IF;

    v_fee := public.platform_fee_for(p_amount);

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, payer_name,
        collected_by, status, platform_fee, fee_settled
    )
    VALUES (
        v_bill.id, v_bill.venue_id, p_amount, 'cash',
        'CASH-' || upper(substr(md5(random()::text), 1, 8)),
        p_payer_name, v_collected_by, 'success', v_fee, false
    );

    v_new_paid := v_bill.amount_paid + p_amount;
    IF v_new_paid >= v_bill.total - 0.005
       AND NOT (COALESCE(v_bill.deposit_paid, false)
                AND (COALESCE(v_bill.deposit_amount, 0) - v_bill.total) > 0.005) THEN
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
    VALUES (v_bill.venue_id, 'staff', v_staff_name, 'cash_payment_recorded', 'bill', v_bill.id,
            jsonb_build_object('amount', p_amount, 'platform_fee', v_fee, 'remaining', GREATEST(v_new_paid - v_bill.total, 0)));

    RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'bill_status', v_status,
                              'remaining', GREATEST(v_bill.total - v_new_paid, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_payment(uuid, numeric, uuid, text) TO anon, authenticated, service_role;

-- ═══ DATA REPAIR — 2026-10-03 incident (executable, no placeholders) ═══

-- 1. Reopen the live deposit bill: GH₵ 2,000 paid, 669.90 spent,
--    GH₵ 1,330.10 credit back on the table. The guarded recalc then
--    re-derives every column and KEEPS it 'settling' / closed_at NULL.
UPDATE public.bills
   SET status = 'settling', closed_at = NULL, updated_at = now()
 WHERE id = '38418bdf-9289-4d8f-bf84-6a84f759f4f6';

SELECT public.recalculate_single_bill('38418bdf-9289-4d8f-bf84-6a84f759f4f6');

-- 2. Cancel the two junk empty bills spawned after the kill
--    (4219d973 = duplicate on the same table, c15d3dd5 = wrong-table
--    bill from the phone). Money-guarded: only zero-money open bills
--    are touched, so this is safe to re-run.
UPDATE public.bills b
   SET status = 'cancelled', closed_at = now(), updated_at = now()
 WHERE (b.id::text LIKE '4219d973-%' OR b.id::text LIKE 'c15d3dd5-%')
   AND b.status = 'open'
   AND b.closed_at IS NULL
   AND b.deposit_paid = false
   AND COALESCE(b.remaining_credit, 0) = 0
   AND COALESCE(b.amount_paid, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM public.payments p
                   WHERE p.bill_id = b.id AND p.status = 'success');

-- 3. Close the sessions that owned the junk bills.
--    (customer_sessions has closed_at / last_active_at — no updated_at.)
UPDATE public.customer_sessions cs
   SET status = 'closed', closed_at = now(), last_active_at = now()
 WHERE cs.status = 'active'
   AND cs.bill_id IN (SELECT b.id FROM public.bills b
                       WHERE (b.id::text LIKE '4219d973-%' OR b.id::text LIKE 'c15d3dd5-%')
                         AND b.status = 'cancelled');

-- 4. VERIFY — expect: 38418bdf settling / closed_at NULL / credit 1330.10;
--    the other two cancelled with closed_at set.
SELECT LEFT(id::text, 8)  AS bill,
       status, closed_at, total, amount_paid,
       deposit_paid, remaining_credit, table_pin
  FROM public.bills
 WHERE id = '38418bdf-9289-4d8f-bf84-6a84f759f4f6'
    OR id::text LIKE '4219d973-%'
    OR id::text LIKE 'c15d3dd5-%';

-- ── D. Heal migration 16's session sweep: same column mistake ──
--    handle_bar_station_shift_end() (live from migration 16) references
--    customer_sessions.updated_at, which does not exist — PL/pgSQL does
--    not validate columns at CREATE time, so the sweep would throw
--    42703 the moment a bar shift ends with an active session. This is
--    the corrected copy (closed_at / last_active_at only).
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
