-- open_bill_for_waiter: waiter-side bill opening/claiming.
-- Reuses the newest open bill for the table, claims it if waiterless,
-- otherwise creates a fresh bill owned by the waiter.
-- Fixes the "waiter-created bills have no waiter" ghost-table source.

CREATE OR REPLACE FUNCTION public.open_bill_for_waiter(
    p_table_id uuid,
    p_staff_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venue_id uuid;
    v_waiter_venue uuid;
    v_bill_id uuid;
BEGIN
    -- 1) Must be a real active table.
    SELECT venue_id INTO v_venue_id
    FROM public.tables
    WHERE id = p_table_id AND is_active = true;
    IF v_venue_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2) Must be an active staff member of the SAME venue.
    SELECT venue_id INTO v_waiter_venue
    FROM public.staff
    WHERE id = p_staff_id AND is_active = true;
    IF v_waiter_venue IS NULL OR v_waiter_venue <> v_venue_id THEN
        RETURN NULL;
    END IF;

    -- 3) Reuse the newest open/settling bill for the table.
    SELECT id INTO v_bill_id
    FROM public.bills
    WHERE table_id = p_table_id AND status IN ('open', 'settling')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_bill_id IS NOT NULL THEN
        -- Claim it ONLY if it has no waiter yet (never steal).
        UPDATE public.bills
        SET waiter_id = p_staff_id, updated_at = now()
        WHERE id = v_bill_id AND waiter_id IS NULL;
        RETURN v_bill_id;
    END IF;

    -- 5) No open bill: create one owned by this waiter.
    INSERT INTO public.bills (venue_id, table_id, waiter_id, guest_count)
    VALUES (v_venue_id, p_table_id, p_staff_id, 1)
    RETURNING id INTO v_bill_id;

    RETURN v_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_bill_for_waiter(uuid, uuid) TO authenticated;