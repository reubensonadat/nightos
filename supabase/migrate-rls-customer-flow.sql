-- Force-heal the customer (QR) flow RLS on the APP project.
-- Run ALL of this in the SQL Editor of the app project (ref uftbkgdyxwhrfplqtfcb).
-- Safe to run repeatedly: helpers are CREATE OR REPLACE, policies are DROP+CREATE.

-- ── 1. Session-token helpers (mirror seed-velvet.sql §8) ────────────────
CREATE OR REPLACE FUNCTION public.request_session_token()
RETURNS text AS $$
    SELECT nullif(current_setting('request.headers', true)::json->>'x-session-token', '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.session_token_matches_bill(p_bill_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_sessions cs
        WHERE cs.bill_id = p_bill_id
          AND cs.session_token = public.request_session_token()
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.session_token_matches_self(p_session_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.customer_sessions cs
        WHERE cs.id = p_session_id
          AND cs.session_token = public.request_session_token()
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.request_session_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_token_matches_bill(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_token_matches_self(uuid) TO anon, authenticated;

-- ── 2. RLS policies (all idempotent) ────────────────────────────────────

-- tables: anyone can read active tables (QR lookup)
DROP POLICY IF EXISTS "Customers can read tables" ON public.tables;
CREATE POLICY "Customers can read tables" ON public.tables
    FOR SELECT USING (is_active = true);

-- customer_sessions
DROP POLICY IF EXISTS "Customers can create sessions" ON public.customer_sessions;
CREATE POLICY "Customers can create sessions" ON public.customer_sessions
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Customers can read sessions" ON public.customer_sessions;
CREATE POLICY "Customers can read sessions" ON public.customer_sessions
    FOR SELECT USING (status = 'active' OR public.session_token_matches_self(id));
DROP POLICY IF EXISTS "Customers can update own session" ON public.customer_sessions;
CREATE POLICY "Customers can update own session" ON public.customer_sessions
    FOR UPDATE USING (public.session_token_matches_self(id));

-- bills
DROP POLICY IF EXISTS "Customers can open bills" ON public.bills;
CREATE POLICY "Customers can open bills" ON public.bills
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Customers can read open bills" ON public.bills;
CREATE POLICY "Customers can read open bills" ON public.bills
    FOR SELECT USING (status IN ('open', 'settling') OR public.session_token_matches_bill(id));
DROP POLICY IF EXISTS "Customers can update own bill" ON public.bills;
CREATE POLICY "Customers can update own bill" ON public.bills
    FOR UPDATE USING (public.session_token_matches_bill(id));

-- order_submissions: submit + read own
DROP POLICY IF EXISTS "Customers can submit orders" ON public.order_submissions;
CREATE POLICY "Customers can submit orders" ON public.order_submissions
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));
DROP POLICY IF EXISTS "Customers read own submissions" ON public.order_submissions;
CREATE POLICY "Customers read own submissions" ON public.order_submissions
    FOR SELECT USING (public.session_token_matches_bill(bill_id));

-- ORDER_ITEMS (this is the missing piece — kitchen said received, items never landed)
DROP POLICY IF EXISTS "Customers can add items" ON public.order_items;
CREATE POLICY "Customers can add items" ON public.order_items
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));
DROP POLICY IF EXISTS "Customers read own items" ON public.order_items;
CREATE POLICY "Customers read own items" ON public.order_items
    FOR SELECT USING (public.session_token_matches_bill(bill_id));
DROP POLICY IF EXISTS "Staff place order items" ON public.order_items;
CREATE POLICY "Staff place order items" ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills b
            WHERE b.id = bill_id AND b.status IN ('open', 'settling')
        )
    );

-- payments: customer records cash/bank on their own bill
DROP POLICY IF EXISTS "Customers can record payments" ON public.payments;
CREATE POLICY "Customers can record payments" ON public.payments
    FOR INSERT WITH CHECK (public.session_token_matches_bill(bill_id));