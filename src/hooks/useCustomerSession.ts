import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { db, type DbBill, type DbTable } from '../lib/api'

export type CustomerSession = {
  id: string
  venue_id: string
  table_id: string
  bill_id: string | null
  guest_name: string
  party_size: number
  session_token: string
  status: 'active' | 'closed' | 'expired'
  created_at: string
  last_active_at: string
}

export type AssignedWaiter = {
  id: string
  name: string
}

type SessionState = {
  session: CustomerSession | null
  bill: DbBill | null
  table: DbTable | null
  waiter: AssignedWaiter | null
  loading: boolean
  error: string | null
  isNewTab: boolean
  isBarClosed: boolean
}

export function useCustomerSession(venueId: string | null, tableId: string | null) {
  const [state, setState] = useState<SessionState>({
    session: null,
    bill: null,
    table: null,
    waiter: null,
    loading: false,
    error: null,
    isNewTab: false,
    isBarClosed: false,
  })

  const inFlightRef = useRef(false)

  const assignWaiter = useCallback(async (billId: string, token: string) => {
    try {
      const { data: waiterId } = await supabase
        .rpc('assign_waiter_to_bill', { p_bill_id: billId })
        .setHeader('x-session-token', token)
      if (!waiterId) {
        await supabase
          .from('bills')
          .update({ waiter_id: null })
          .setHeader('x-session-token', token)
          .eq('id', billId)
        setState((s) => ({ ...s, waiter: null }))
        return
      }

      // Verify waiter is currently ON DUTY (active shift)
      const { data: activeShift } = await supabase
        .from('staff_shifts')
        .select('id')
        .eq('staff_id', waiterId as string)
        .eq('status', 'active')
        .maybeSingle()

      if (!activeShift) {
        await supabase
          .from('bills')
          .update({ waiter_id: null })
          .setHeader('x-session-token', token)
          .eq('id', billId)
        setState((s) => ({ ...s, waiter: null }))
        return
      }

      const { data: staff } = await supabase
        .from('staff')
        .select('id, name')
        .eq('id', waiterId as string)
        .maybeSingle()
      setState((s) => ({ ...s, waiter: staff ? { id: staff.id, name: staff.name } : null }))
    } catch {
      setState((s) => ({ ...s, waiter: null }))
    }
  }, [])

  /** Flip a non-active session back to `active` (its tab is still live). */
  const reviveSession = useCallback(async (owner: CustomerSession): Promise<CustomerSession | null> => {
    try {
      const { data: revived } = await supabase
        .from('customer_sessions')
        .update({ status: 'active', last_active_at: new Date().toISOString() })
        .setHeader('x-session-token', owner.session_token)
        .eq('id', owner.id)
        .select()
        .maybeSingle()
      return revived ? (revived as CustomerSession) : null
    } catch {
      return null
    }
  }, [])

  /**
   * Revive the session only if the bill it owns is still open/settling
   * (unpaid). If the bill is gone or settled, the session stays dead.
   */
  const reviveIfBillOpen = useCallback(
    async (owner: CustomerSession): Promise<CustomerSession | null> => {
      try {
        if (!owner.bill_id) return null
        const { data: ownerBill } = await db.billById(owner.bill_id)
        if (!ownerBill || (ownerBill.status !== 'open' && ownerBill.status !== 'settling')) return null
        return reviveSession(owner)
      } catch {
        return null
      }
    },
    [reviveSession],
  )

  const ensureSession = useCallback(async () => {
    if (!venueId || !tableId) return
    if (inFlightRef.current) return
    inFlightRef.current = true

    try {
      setState((s) => ({ ...s, loading: true, error: null }))

      // 0. Verify Bar Station is active (Strict: Require active bar shift for service)
      try {
        const { data: activeBar } = await db.activeBarShift(venueId)
        if (!activeBar || activeBar.status !== 'active') {
          setState((s) => ({
            ...s,
            session: null,
            bill: null,
            waiter: null,
            loading: false,
            error: null,
            isBarClosed: true,
          }))
          return
        }
      } catch {
        setState((s) => ({
          ...s,
          session: null,
          bill: null,
          waiter: null,
          loading: false,
          error: null,
          isBarClosed: true,
        }))
        return
      }

      // 1. Try to find existing active session for this table
      const { data: existingSession, error: sessionErr } = await supabase
        .from('customer_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .eq('table_id', tableId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionErr) {
        setState((s) => ({ ...s, session: null, bill: null, loading: false, error: 'Failed to load session' }))
        return
      }

      let session = existingSession as CustomerSession | null

      // If the session is still active but its bill is paid/cancelled,
      // close it and start a fresh one
      if (session && session.bill_id) {
        try {
          const { data: linkedBill } = await db.billById(session.bill_id)
          if (linkedBill && (linkedBill.status === 'paid' || linkedBill.status === 'cancelled')) {
            await supabase
              .from('customer_sessions')
              .update({ status: 'closed' })
              .eq('id', session.id)
            session = null
            try { localStorage.removeItem('nightos:cart') } catch { /* noop */ }
          }
        } catch { /* noop */ }
      }

      // 1b. Session expired
      if (!session) {
        try {
          const { data: latestSession } = await supabase
            .from('customer_sessions')
            .select('*')
            .eq('venue_id', venueId)
            .eq('table_id', tableId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (latestSession && latestSession.status === 'expired') {
            const revived = await reviveIfBillOpen(latestSession as CustomerSession)
            if (revived) {
              session = revived
            } else {
              let wasMySession = false
              try { wasMySession = sessionStorage.getItem('nightos:current_session_id') === latestSession.id } catch { /* noop */ }

              if (wasMySession) {
                setState((s) => ({ ...s, session: latestSession as CustomerSession, bill: null, loading: false, error: null }))
                return
              }
            }
          }
        } catch { /* noop */ }
      }

      // 1c. Live bill on table
      if (!session) {
        try {
          const { data: openBill } = await db.openBillForTable(tableId)
          if (openBill) {
            const { data: owner } = await supabase
              .from('customer_sessions')
              .select('*')
              .eq('bill_id', openBill.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (owner) {
              const revived = owner.status === 'active'
                ? (owner as CustomerSession)
                : await reviveSession(owner as CustomerSession)
              if (revived) session = revived
            }
          }
        } catch { /* noop */ }
      }

      let bill = null

      // 2. Only create a session when there's NO live tab on the table
      if (!session) {
        const { data: newSession, error: createErr } = await supabase
          .from('customer_sessions')
          .insert({
            venue_id: venueId,
            table_id: tableId,
            guest_name: 'Guest',
            party_size: 1,
          })
          .select()
          .maybeSingle()

        if (createErr || !newSession) {
          setState((s) => ({ ...s, session: null, bill: null, loading: false, error: 'Failed to create session' }))
          return
        }
        session = newSession as CustomerSession
      }

      if (session) {
        try { sessionStorage.setItem('nightos:current_session_id', session.id) } catch { /* noop */ }
      }

      const token = session.session_token

      // 3. Bill check
      if (session.bill_id) {
        const { data: sessionBill, error: sessionBillErr } = await db.billById(session.bill_id)
        if (sessionBillErr) {
          setState((s) => ({ ...s, session, bill: null, loading: false, error: 'Failed to load bill' }))
          return
        }
        if (sessionBill && (sessionBill.status === 'open' || sessionBill.status === 'settling')) {
          bill = sessionBill
        }
      }

      let createdFreshBill = false

      if (!bill) {
        // 3b. Open or create bill for this table
        const { data: existingBill, error: billErr } = await db.openBillForTable(tableId)
        if (billErr) {
          setState((s) => ({ ...s, session, bill: null, isNewTab: false, loading: false, error: 'Failed to load bill' }))
          return
        }

        const { data: currentTable } = await db.tableById(tableId)
        const minDeposit = Number(currentTable?.min_deposit || 0)

        if (existingBill) {
          bill = existingBill
          if (minDeposit > 0 && !existingBill.deposit_paid && Number(existingBill.deposit_amount || 0) === 0) {
            bill.deposit_amount = minDeposit
          }
          if (session.bill_id !== existingBill.id) {
            await supabase
              .from('customer_sessions')
              .update({ bill_id: existingBill.id })
              .setHeader('x-session-token', token)
              .eq('id', session.id)
            session = { ...session, bill_id: existingBill.id }
          }
        } else {
          const autoPin = Math.floor(1000 + Math.random() * 9000).toString()
          const { data: newBill, error: createBillErr } = await db.createBill(
            venueId,
            tableId,
            session.party_size || 1,
            token,
            autoPin,
            minDeposit,
            false,
          )
          if (createBillErr || !newBill) {
            setState((s) => ({ ...s, session, bill: null, table: currentTable ?? null, isNewTab: false, loading: false, error: 'Failed to create bill' }))
            return
          }
          bill = newBill
          createdFreshBill = true
          try { localStorage.setItem(`nightos:table_pin:${newBill.id}`, autoPin) } catch { /* noop */ }
          await supabase
            .from('customer_sessions')
            .update({ bill_id: newBill.id })
            .setHeader('x-session-token', token)
            .eq('id', session.id)
          session = { ...session, bill_id: newBill.id }
        }
      }

      const resolvedTable = (state.table) || (tableId ? (await db.tableById(tableId)).data : null)

      if (bill?.table_pin) {
        try {
          if (session && localStorage.getItem(`nightos:party:${session.id}`) === '1') {
            localStorage.setItem(`nightos:table_pin:${bill.id}`, bill.table_pin)
          }
        } catch { /* noop */ }
      }

      setState((s) => ({ ...s, session, bill, table: resolvedTable ?? null, isNewTab: createdFreshBill, isBarClosed: false, loading: false, error: null }))

      if (bill && !createdFreshBill) assignWaiter(bill.id, token)
    } catch (err) {
      console.error('[useCustomerSession] Error during ensureSession:', err)
      setState((s) => ({ ...s, loading: false, error: 'Could not connect to table session' }))
    } finally {
      inFlightRef.current = false
    }
  }, [venueId, tableId, assignWaiter, reviveSession, reviveIfBillOpen])

  const ensureSessionRef = useRef(ensureSession)
  ensureSessionRef.current = ensureSession

  useEffect(() => {
    const init = async () => {
      await ensureSession()
    }
    init()
  }, [ensureSession])

  // Realtime listener for bar station open/close
  useEffect(() => {
    if (!venueId) return
    try {
      const channel = supabase
        .channel(`customer_bar_shift_${venueId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bar_station_shifts', filter: `venue_id=eq.${venueId}` },
          () => {
            void ensureSessionRef.current()
          },
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    } catch {
      // Realtime subscription error catch
    }
  }, [venueId])

  /**
   * Customer confirms their party size before ordering. Updates the
   * session + bill (guest_count feeds waiter load balancing) and then
   * (re)assigns the waiter with the new headcount.
   */
  const updateParty = useCallback(
    async (partySize: number, guestName?: string) => {
      const { session, bill } = state
      if (!session || !bill) return { error: 'Session not ready' }

      const name = guestName?.trim() || session.guest_name || 'Guest'
      const { data: updated, error } = await supabase
        .from('customer_sessions')
        .update({ party_size: partySize, guest_name: name })
        .setHeader('x-session-token', session.session_token)
        .eq('id', session.id)
        .select()
        .maybeSingle()

      if (error) return { error: 'Failed to save party size' }

      const tablePin = bill.table_pin || Math.floor(1000 + Math.random() * 9000).toString();
      const { error: billErr } = await db.updateBill(
        bill.id,
        { guest_count: partySize, table_pin: tablePin },
        session.session_token,
      )
      if (billErr) return { error: 'Failed to save party size' }

      try { localStorage.setItem(`nightos:table_pin:${bill.id}`, tablePin); } catch { /* noop */ }

      setState((s) => ({
        ...s,
        session: { ...(updated as CustomerSession), bill_id: s.session?.bill_id ?? null },
        bill: bill ? { ...bill, guest_count: partySize, table_pin: tablePin } : bill,
      }))

      await assignWaiter(bill.id, session.session_token)
      return { error: null }
    },
    [state, assignWaiter],
  )

  const refresh = useCallback(() => {
    ensureSession()
  }, [ensureSession])

  return { ...state, refresh, updateParty }
}
