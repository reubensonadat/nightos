import { useCallback, useEffect, useState } from 'react';
import { db, type DbBill } from '../lib/api';

type BillState = {
  bill: DbBill | null;
  loading: boolean;
  error: string | null;
};

export function useBill(venueId: string | null, tableId: string | null) {
  const [state, setState] = useState<BillState>({ bill: null, loading: false, error: null });

  const ensureBill = useCallback(async () => {
    if (!venueId || !tableId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data: existing, error: fetchErr } = await db.openBillForTable(tableId);
    if (fetchErr) {
      setState({ bill: null, loading: false, error: 'Failed to fetch bill' });
      return;
    }

    if (existing) {
      setState({ bill: existing, loading: false, error: null });
      return;
    }

    const { data: newBill, error: createErr } = await db.createBill(venueId, tableId);
    if (createErr || !newBill) {
      setState({ bill: null, loading: false, error: 'Failed to create bill' });
      return;
    }
    setState({ bill: newBill, loading: false, error: null });
  }, [venueId, tableId]);

  useEffect(() => {
    const init = async () => {
        await ensureBill();
    };
    init();
    }, [ensureBill]);

  const refresh = useCallback(() => {
    ensureBill();
  }, [ensureBill]);

  return { ...state, refresh };
}
