-- Payment trust hardening (mirrors Roomate_link's enforce_payment_integrity):
-- 1. Customers may only RECORD pending payments (never success).
-- 2. A bill may only flip to 'paid' when verified money covers it on the books.
--    Only the server (service_role) or real recorded cash can ever close a bill.

-- ── 1. Customers record pends, never successes ─────────────────────────
DROP POLICY IF EXISTS "Customers can record payments" ON public.payments;
CREATE POLICY "Customers can record payments" ON public.payments
    FOR INSERT WITH CHECK (
        public.session_token_matches_bill(bill_id)
        AND status = 'pending'
    );

-- ── 2. Bill-close guard: 'paid' requires real money recorded ────────────
CREATE OR REPLACE FUNCTION public.bill_close_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.status = 'paid' THEN
        IF (SELECT coalesce(sum(amount), 0) FROM public.payments
            WHERE bill_id = NEW.id AND status = 'success') >= NEW.total
        THEN
            RETURN NEW;
        END IF;
        IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Bill cannot be marked paid without a confirmed payment';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bills_guard_close ON public.bills;
CREATE TRIGGER trg_bills_guard_close
    BEFORE UPDATE OF status ON public.bills
    FOR EACH ROW
    EXECUTE FUNCTION public.bill_close_guard();