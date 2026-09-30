-- ─────────────────────────────────────────────────────────────
-- 11 — Bar Shift Dependent Ordering & Automatic Waiter Handover
-- ─────────────────────────────────────────────────────────────

-- 1. Bar Station Shifts Table (Cross-Device Realtime Sync)
CREATE TABLE IF NOT EXISTS public.bar_station_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    started_by_staff_id uuid,
    started_by_staff_name text,
    starting_float numeric(10,2) NOT NULL DEFAULT 200,
    opening_stock jsonb NOT NULL DEFAULT '{}'::jsonb,
    restocks jsonb NOT NULL DEFAULT '[]'::jsonb,
    drawn_stock jsonb NOT NULL DEFAULT '{}'::jsonb,
    direct_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
    closing_stock jsonb,
    closing_cash_counted numeric(10,2),
    summary_totals jsonb,
    handover_notes text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    ended_at timestamptz,
    ended_by_staff_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Realtime & RLS
ALTER TABLE public.bar_station_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bar_station_shifts_select" ON public.bar_station_shifts;
DROP POLICY IF EXISTS "bar_station_shifts_modify" ON public.bar_station_shifts;

CREATE POLICY "bar_station_shifts_select" ON public.bar_station_shifts FOR SELECT USING (true);
CREATE POLICY "bar_station_shifts_modify" ON public.bar_station_shifts FOR ALL USING (true);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'bar_station_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bar_station_shifts;
    END IF;
END $$;

-- 2. Enhanced clock_out_staff with Automatic Waiter Handover
-- When a waiter clocks out, their open/settling tables are automatically transferred
-- to another active waiter on shift. If no other waiters are active, tables become Unassigned (NULL).
CREATE OR REPLACE FUNCTION public.clock_out_staff(p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_venue_id uuid;
    v_next_waiter_id uuid;
BEGIN
    -- 1. Get staff venue
    SELECT venue_id INTO v_venue_id FROM public.staff WHERE id = p_staff_id;
    IF NOT FOUND THEN
        SELECT venue_id INTO v_venue_id FROM public.staff_shifts WHERE staff_id = p_staff_id ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 2. Mark shift closed
    UPDATE public.staff_shifts
    SET status = 'closed', clock_out = now()
    WHERE staff_id = p_staff_id AND status IN ('active', 'on_break');

    -- 3. Find another active waiter on shift with the least open bills in this venue
    IF v_venue_id IS NOT NULL THEN
        SELECT s.id INTO v_next_waiter_id
        FROM public.staff s
        LEFT JOIN public.bills b ON b.waiter_id = s.id AND b.status IN ('open', 'settling')
        WHERE s.venue_id = v_venue_id
          AND s.id != p_staff_id
          AND s.role = 'waiter'
          AND s.is_active = true
          AND EXISTS (SELECT 1 FROM public.staff_shifts ss WHERE ss.staff_id = s.id AND ss.status = 'active')
        GROUP BY s.id
        ORDER BY COUNT(b.id) ASC
        LIMIT 1;

        -- 4. Reassign open bills of this clocking-out waiter to the next waiter (or NULL if none on duty)
        UPDATE public.bills
        SET waiter_id = v_next_waiter_id, updated_at = now()
        WHERE waiter_id = p_staff_id AND status IN ('open', 'settling');
    END IF;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_out_staff(uuid) TO anon, authenticated, service_role;

-- 3. Helper: Check if Bar Station is Active
CREATE OR REPLACE FUNCTION public.is_bar_station_active(p_venue_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
    v_active boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.bar_station_shifts
        WHERE venue_id = p_venue_id AND status = 'active'
    ) INTO v_active;
    RETURN COALESCE(v_active, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_bar_station_active(uuid) TO anon, authenticated, service_role;

-- 4. DB Trigger: Automatically close active customer sessions & open bills when Bar Station shift ends
CREATE OR REPLACE FUNCTION public.handle_bar_station_shift_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') THEN
        -- Close all active customer sessions
        UPDATE public.customer_sessions
        SET status = 'closed', updated_at = now()
        WHERE venue_id = NEW.venue_id AND status = 'active';

        -- Close all open / settling bills
        UPDATE public.bills
        SET status = 'closed', closed_at = now(), updated_at = now()
        WHERE venue_id = NEW.venue_id AND status IN ('open', 'settling') AND closed_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bar_station_shift_end ON public.bar_station_shifts;
CREATE TRIGGER trg_bar_station_shift_end
    AFTER UPDATE ON public.bar_station_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_bar_station_shift_end();

