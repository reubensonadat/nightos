import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { db, type DbOrderSubmission } from '../lib/api';

type OrdersState = {
  orders: DbOrderSubmission[];
  loading: boolean;
  error: string | null;
};

export function useOrders(venueId: string | null, station?: string) {
  const [state, setState] = useState<OrdersState>({ orders: [], loading: true, error: null });

  const fetchOrders = useCallback(async () => {
    if (!venueId) {
      setState({ orders: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const { data, error } = await db.orderSubmissionsByVenue(venueId, station);
    if (error) {
      setState({ orders: [], loading: false, error: 'Failed to fetch orders' });
      return;
    }
    setState({ orders: data, loading: false, error: null });
  }, [venueId, station]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onInsertRef = useRef<((row: DbOrderSubmission) => void) | null>(null);
  const onUpdateRef = useRef<((row: DbOrderSubmission) => void) | null>(null);

  useEffect(() => {
    onInsertRef.current = (row: DbOrderSubmission) => {
      setState((s) => ({ ...s, orders: [row, ...s.orders] }));
    };
    onUpdateRef.current = (row: DbOrderSubmission) => {
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) => (o.id === row.id ? row : o)),
      }));
    };
  }, []);

  useEffect(() => {
    if (!venueId) return;

    const filter = `venue_id=eq.${venueId}`;
    const channel = supabase
      .channel(`orders:${venueId}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'order_submissions',
          filter,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') onInsertRef.current?.(payload.new);
          else if (payload.eventType === 'UPDATE') onUpdateRef.current?.(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  return { ...state, refresh: fetchOrders };
}
