import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type UseRealtimeOptions<T> = {
  table: string;
  filter?: string;
  event?: EventType;
  /** When false (or when `table` is falsy) no channel is created — prevents
   *  table-wide subscriptions before venue/bill context has resolved. */
  enabled?: boolean;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T, oldRow?: Partial<T>) => void;
  onDelete?: (oldRow: Partial<T>) => void;
};

/** Monotonic per-instance suffix: unique channel topics (no socket collisions)
 *  without the dangling anonymous-random names. */
let channelSeq = 0;

export function useRealtime<T extends Record<string, unknown>>({
  table,
  filter,
  event = '*',
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  });

  useEffect(() => {
    if (!enabled || !table) return;

    let isMounted = true;
    const channelName = `realtime:${table}:${filter ?? 'all'}:${++channelSeq}`;

    const channel = supabase
      .channel(channelName)
      .on<T>(
        'postgres_changes' as never,
        {
          event: event as never,
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          // unsubscribe() is async — drop payloads that land after cleanup
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') onInsertRef.current?.(payload.new as T);
          else if (payload.eventType === 'UPDATE') onUpdateRef.current?.(payload.new as T, payload.old as T);
          else if (payload.eventType === 'DELETE') onDeleteRef.current?.(payload.old as T);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      const destroy = () => {
        channel.teardown();
        supabase.removeChannel(channel);
      };
      // unsubscribe before removal so the Phoenix socket acks the leave,
      // releasing heartbeat timers / pending push callbacks.
      void channel.unsubscribe().then(destroy).catch(destroy);
    };
  }, [table, filter, event, enabled]);
}
