import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type UseRealtimeOptions<T> = {
  table: string;
  filter?: string;
  event?: EventType;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T, oldRow?: Partial<T>) => void;
  onDelete?: (oldRow: Partial<T>) => void;
};

export function useRealtime<T extends Record<string, unknown>>({
  table,
  filter,
  event = '*',
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
    const channelName = `realtime:${table}:${filter ?? 'all'}-${Math.random().toString(36).slice(2, 9)}`;

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
          if (payload.eventType === 'INSERT') onInsertRef.current?.(payload.new as T);
          else if (payload.eventType === 'UPDATE') onUpdateRef.current?.(payload.new as T, payload.old as T);
          else if (payload.eventType === 'DELETE') onDeleteRef.current?.(payload.old as T);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event]);
}
