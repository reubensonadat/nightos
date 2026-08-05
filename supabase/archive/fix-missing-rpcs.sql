-- ================================================================
-- NightOS — Critical SQL Fixes
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- ── FIX 1: assign_waiter_to_bill RPC ─────────────────────────────
-- Called by useCustomerSession and the assign-waiter edge function.
-- Assigns the least-loaded active waiter to a newly created bill.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bill  public.bills%ROWTYPE;
  v_waiter_id uuid;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_bill.waiter_id IS NOT NULL THEN RETURN v_bill.waiter_id; END IF;

  SELECT s.id INTO v_waiter_id
  FROM   public.staff s
  LEFT JOIN public.bills b
         ON b.waiter_id = s.id
        AND b.status IN ('open', 'settling')
  WHERE  s.venue_id  = v_bill.venue_id
    AND  s.is_active = true
    AND  s.role      IN ('waiter', 'supervisor')
  GROUP BY s.id
  ORDER BY COUNT(b.id) ASC, RANDOM()
  LIMIT 1;

  IF v_waiter_id IS NOT NULL THEN
    UPDATE public.bills
       SET waiter_id  = v_waiter_id,
           updated_at = now()
     WHERE id = p_bill_id;
  END IF;

  RETURN v_waiter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_waiter_to_bill(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_waiter_to_bill(uuid) TO authenticated;


-- ── FIX 2: RLS — anon INSERT on customer_sessions ────────────────
DROP POLICY IF EXISTS "Anon can create session" ON public.customer_sessions;
CREATE POLICY "Anon can create session"
  ON public.customer_sessions
  FOR INSERT
  WITH CHECK (true);


-- ── FIX 3: RLS — anon INSERT on bills ────────────────────────────
DROP POLICY IF EXISTS "Anon can create bill" ON public.bills;
CREATE POLICY "Anon can create bill"
  ON public.bills
  FOR INSERT
  WITH CHECK (true);


-- ── FIX 4: RLS — anon INSERT on reservations ─────────────────────
DROP POLICY IF EXISTS "Anyone can create reservation" ON public.reservations;
CREATE POLICY "Anyone can create reservation"
  ON public.reservations
  FOR INSERT
  WITH CHECK (true);


-- ── VERIFY ───────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'assign_waiter_to_bill';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename IN ('customer_sessions','bills','reservations')
--   ORDER BY tablename, policyname;
