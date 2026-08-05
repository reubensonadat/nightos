-- ═══════════════════════════════════════════════════════════════════
-- AUTO SHIFTS — clock-in on sign-in, clock-out on sign-out
--
-- staff_shifts existed but nothing ever wrote to it, so waiter
-- auto-assign (assign_waiter_to_bill) and the LiveOps coverage stats
-- were dead code. These two RPCs wire the intended rule:
--   successful sign-in  → clock_in_staff()  (idempotent: reuses the
--                         existing active/on_break shift, so reloads
--                         and token refreshes can't double-clock)
--   sign-out             → clock_out_staff() (closes active/on_break,
--                         sets clock_out = now())
--
-- Also adds a venue-wide shift read policy — previously only the owner
-- could read shifts, so a manager-role staff member saw zero coverage.
--
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR. Idempotent.
-- Mirrored in supabase/01-schema-and-logic.sql.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.clock_in_staff(p_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_venue_id uuid;
BEGIN
    SELECT venue_id INTO v_venue_id
    FROM public.staff
    WHERE id = p_staff_id AND is_active = true;
    IF v_venue_id IS NULL THEN
        RETURN false;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.staff_shifts
        WHERE staff_id = p_staff_id AND status IN ('active', 'on_break')
    ) THEN
        INSERT INTO public.staff_shifts (staff_id, venue_id, status)
        VALUES (p_staff_id, v_venue_id, 'active');
    END IF;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_out_staff(p_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.staff_shifts
    SET status = 'closed', clock_out = now()
    WHERE staff_id = p_staff_id AND status IN ('active', 'on_break');
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_in_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out_staff(uuid) TO authenticated;

-- Venue members (not just the owner) can read shifts for coverage stats.
DROP POLICY IF EXISTS "Venue members can read shifts" ON public.staff_shifts;
CREATE POLICY "Venue members can read shifts" ON public.staff_shifts
    FOR SELECT USING (public.is_venue_member(venue_id));