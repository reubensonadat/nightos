DO $$
BEGIN
    DELETE FROM public.order_items WHERE guest_name = 'Mock Order';
    DELETE FROM public.order_submissions WHERE guest_name = 'Mock Order';
    -- Can optionally delete bills if they are empty, but since we didn't mark the bills explicitly, we can leave the empty open bill, or delete bills that have no items.
    DELETE FROM public.bills WHERE guest_count = 2 AND status = 'open' AND not exists (select 1 from public.order_submissions where bill_id = public.bills.id);
END $$;
