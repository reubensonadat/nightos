-- migrate-payment-hardening.sql
-- Hardens the money path per SYSTEM_FLOW §4.2 (payment integrity).
--   (1) Consolidate the two competing auto-close triggers into one.
--   (2) payment_events: composite unique key so manual_verify + charge.success
--       + refund events all survive (previously one overwrote the other).
--   (3) Cap cash overpayment at the remaining balance.
-- Idempotent: safe to run more than once.

-- ─────────────────────────────────────────────────────────────
-- (1) CONSOLIDATE AUTO-CLOSE TRIGGERS
-- Old `update_bill_payment` did `amount_paid = amount_paid + NEW.amount`
-- (unbounded, double-credits when both triggers fire). The keeper is
-- `bill_auto_close_on_payment`, which recomputes Σ(success) and honours the
-- 0.005 GHS rounding tolerance.
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_payment_success ON public.payments;
DROP FUNCTION IF EXISTS public.update_bill_payment();

-- ─────────────────────────────────────────────────────────────
-- (2) payment_events COMPOSITE KEY (reference + event_type)
-- verify-payment writes `manual_verify`; the webhook writes `charge.success`,
-- `amount_mismatch_rejected`, `charge.refund`/`refund.processed`. All of them
-- for the same reference must survive (auditability — Invariant 6).
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.payment_events_paystack_reference_key;
ALTER TABLE public.payment_events DROP CONSTRAINT IF EXISTS payment_events_reference;
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_reference_event_key
    ON public.payment_events (paystack_reference, event_type);

-- ─────────────────────────────────────────────────────────────
-- (3) CASH OVERPAYMENT CAP
-- `record_cash_payment` now caps the recorded amount at the remaining balance
-- and refuses when the bill is already covered. The platform fee is computed
-- on the actual amount collected.
-- ─────────────────────────────────────────────────────────────
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
    v_amount numeric;
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

    -- Cap overpayment at the remaining balance (Invariant: never credit more
    -- than is owed). A fully-covered bill is refused outright.
    v_amount := p_amount;
    IF v_amount > GREATEST(v_bill.total - v_bill.amount_paid, 0) THEN
        v_amount := GREATEST(v_bill.total - v_bill.amount_paid, 0);
    END IF;
    IF v_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_already_covered');
    END IF;

    v_fee := public.platform_fee_for(v_amount);

    INSERT INTO public.payments (
        bill_id, venue_id, amount, method, reference, payer_name,
        collected_by, status, platform_fee, fee_settled
    )
    VALUES (
        v_bill.id, v_bill.venue_id, v_amount, 'cash',
        'CASH-' || upper(substr(md5(random()::text), 1, 8)),
        p_payer_name, v_staff.id, 'success', v_fee, false
    );

    v_new_paid := v_bill.amount_paid + v_amount;
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
            jsonb_build_object('amount', v_amount, 'platform_fee', v_fee, 'remaining', GREATEST(v_bill.total - v_new_paid, 0)));

    RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'bill_status', v_status,
                              'remaining', GREATEST(v_bill.total - v_new_paid, 0));
END;
$$;
