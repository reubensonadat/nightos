-- ============================================================
-- Bysen: Manager-approved staff shifts
-- Sign-in clocks in, but a waiter is NOT assignable until a
-- manager/supervisor/owner approves that they are physically on
-- duty (kills "clocked in from my bedroom").
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Column: shift starts "pending", manager flips it to approved
ALTER TABLE public.staff_shifts
    ADD COLUMN IF NOT EXISTS supervisor_approved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS staff_shifts_approved_idx
    ON public.staff_shifts (staff_id) WHERE status IN ('active', 'on_break');

-- 2. RPC: only the venue OWNER (auth.uid) or a manager/supervisor of the
--    SAME venue (phone OTP staff) can approve. Taking someone off duty
--    (approve=false) closes their open shift = "clock out".
CREATE OR REPLACE FUNCTION public.approve_shift(
    p_shift_id uuid,
    p_approve boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_shift_venue uuid;
    v_is_owner boolean;
    v_can_manage boolean;
BEGIN
    SELECT ss.venue_id INTO v_shift_venue FROM public.staff_shifts ss WHERE ss.id = p_shift_id;
    IF v_shift_venue IS NULL THEN
        RETURN false;
    END IF;

    SELECT owner_id = auth.uid() INTO v_is_owner
    FROM public.venues WHERE id = v_shift_venue;
    IF v_is_owner THEN
        v_can_manage := true;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.staff
            WHERE venue_id = v_shift_venue
              AND phone = auth.jwt()->>'phone'
              AND role IN ('owner', 'manager', 'supervisor')
              AND is_active = true
        ) INTO v_can_manage;
    END IF;

    IF NOT COALESCE(v_can_manage, false) THEN
        RETURN false;
    END IF;

    IF p_approve THEN
        UPDATE public.staff_shifts
        SET supervisor_approved = true
        WHERE id = p_shift_id;
    ELSE
        -- Taking someone off duty: close their open shift.
        UPDATE public.staff_shifts
        SET status = 'closed', clock_out = now(), supervisor_approved = false
        WHERE id = p_shift_id
          AND status IN ('active', 'on_break');
    END IF;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_shift(uuid, boolean) TO authenticated;

-- 3. LiveOps panel driver: who is on duty / pending / off + performance
--    (assignable = approved active shift).
CREATE OR REPLACE FUNCTION public.shift_coverage(p_venue_id uuid)
RETURNS TABLE (
    staff_id uuid,
    name text,
    role text,
    shift_id uuid,
    shift_status text,
    supervisor_approved boolean,
    clock_in timestamptz,
    open_bills bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id,
           s.name,
           s.role,
           ss.id,
           ss.status,
           ss.supervisor_approved,
           ss.clock_in,
           (SELECT count(*) FROM public.bills b
            WHERE b.waiter_id = s.id AND b.status IN ('open', 'settling'))
    FROM public.staff s
    LEFT JOIN LATERAL (
        SELECT id, status, supervisor_approved, clock_in
        FROM public.staff_shifts ss
        WHERE ss.staff_id = s.id AND ss.status IN ('active', 'on_break')
        ORDER BY ss.clock_in DESC LIMIT 1
    ) ss ON true
    WHERE s.venue_id = p_venue_id AND s.is_active = true
    ORDER BY (ss.supervisor_approved = true) DESC, ss.clock_in DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.shift_coverage(uuid) TO authenticated;

-- ============================================================
-- 4. assign_waiter_to_bill: ONLY approved, on-duty waiters get tables.
--    (All three copies — schema line 677, FIX block removed, seed 8d —
--    must stay identical to this.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_waiter_to_bill(p_bill_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bill  public.bills%ROWTYPE;
    v_table_area text;
    v_best_waiter_id uuid;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Idempotent: a bill that already has a waiter keeps that waiter.
    IF v_bill.waiter_id IS NOT NULL THEN RETURN v_bill.waiter_id; END IF;

    SELECT area INTO v_table_area FROM public.tables WHERE id = v_bill.table_id;

    -- PEOPLE-WEIGHTED LOAD BALANCING (source of truth):
    --   load = SUM(guests on open bills) + 0.5 per open table
    --   (Example: 4 tables of 5 people (load ¥22) loses to 6 tables of 2 (load ¥12))
    -- Hard rules: only waiters, ON SHIFT, MANAGER-APPROVED on duty,
    -- area match, under max_tables.
    SELECT s.id INTO v_best_waiter_id
    FROM   public.staff s
    LEFT JOIN public.bills b
           ON b.waiter_id = s.id
          AND b.status IN ('open', 'settling')
          AND b.id != p_bill_id
    WHERE  s.venue_id  = v_bill.venue_id
      AND  s.role      = 'waiter'
      AND  s.is_active = true
      AND  EXISTS (
          SELECT 1 FROM public.staff_shifts ss
          WHERE ss.staff_id = s.id
            AND ss.status = 'active'
            AND ss.supervisor_approved = true
      )
      AND  (s.area_assignment IS NULL OR s.area_assignment = v_table_area)
      AND  (
          SELECT COUNT(*) FROM public.bills
          WHERE waiter_id = s.id
            AND status IN ('open', 'settling')
            AND id != p_bill_id
      ) < s.max_tables
    GROUP BY s.id, s.max_tables
    ORDER BY COALESCE(SUM(b.guest_count), 0) + 0.5 * COUNT(b.id) ASC,
             MIN(s.created_at) ASC
    LIMIT 1;

    IF v_best_waiter_id IS NOT NULL THEN
      UPDATE public.bills
         SET waiter_id  = v_best_waiter_id,
             updated_at = now()
       WHERE id = p_bill_id;
    END IF;

    RETURN v_best_waiter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_waiter_to_bill(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_waiter_to_bill(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_waiter_to_bill(uuid) TO service_role;