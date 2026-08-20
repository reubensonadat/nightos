import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { db, type DbBill } from '../lib/api'

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
  waiter: AssignedWaiter | null
  loading: boolean
  error: string | null
}

export function useCustomerSession(venueId: string | null, tableId: string | null) {
  const [state, setState] = useState<SessionState>({
    session: null,
    bill: null,
    waiter: null,
    loading: false,
    error: null,
  })

  const assignWaiter = useCallback(async (billId: string, token: string) => {
    const { data: waiterId } = await supabase
      .rpc('assign_waiter_to_bill', { p_bill_id: billId })
      .setHeader('x-session-token', token)
    if (!waiterId) {
      setState((s) => ({ ...s, waiter: null }))
      return
    }
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name')
      .eq('id', waiterId as string)
      .maybeSingle()
    setState((s) => ({ ...s, waiter: staff ? { id: staff.id, name: staff.name } : null }))
  }, [])

  const ensureSession = useCallback(async () => {
    if (!venueId || !tableId) return

    setState((s) => ({ ...s, loading: true, error: null }))

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
    // the previous visit is over — close it and start a fresh one
    // so new guests never see the previous party's items or bill.
    if (session && session.bill_id) {
      const { data: linkedBill } = await db.billById(session.bill_id)
      if (linkedBill && (linkedBill.status === 'paid' || linkedBill.status === 'cancelled')) {
        await supabase
          .from('customer_sessions')
          .update({ status: 'closed' })
          .eq('id', session.id)
        session = null
        // Clear the stale cart so the next party starts empty
        try { localStorage.removeItem('nightos:cart') } catch { /* noop */ }
      }
    }

    // 1b. Session expired (20 min, never ordered) → block ordering until the
    // customer re-scans the table QR code. The waiter/manager keeps seeing
    // the expired session as "landed, never ordered".
    if (!session) {
      const { data: latestSession } = await supabase
        .from('customer_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .eq('table_id', tableId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestSession && latestSession.status === 'expired') {
        setState((s) => ({ ...s, session: latestSession as CustomerSession, bill: null, loading: false, error: null }))
        return
      }
    }

    let bill = null

    // 2. If no active session, create one
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
        .single()

      if (createErr || !newSession) {
        setState((s) => ({ ...s, session: null, bill: null, loading: false, error: 'Failed to create session' }))
        return
      }
      session = newSession as CustomerSession
    }

    const token = session.session_token

    // 3. The session's own bill always wins (it may differ from the newest
    // open bill if a stale duplicate was left on the table). Fall back to
    // the newest open bill only when the session has none.
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

    if (!bill) {
      // 3b. Open or create bill for this table
      const { data: existingBill, error: billErr } = await db.openBillForTable(tableId)
      if (billErr) {
        setState((s) => ({ ...s, session, bill: null, loading: false, error: 'Failed to load bill' }))
        return
      }

      if (existingBill) {
        bill = existingBill
        if (session.bill_id !== existingBill.id) {
          await supabase
            .from('customer_sessions')
            .update({ bill_id: existingBill.id })
            .setHeader('x-session-token', token)
            .eq('id', session.id)
          session = { ...session, bill_id: existingBill.id }
        }
      } else {
        const { data: newBill, error: createBillErr } = await db.createBill(
          venueId,
          tableId,
          session.party_size || 1,
          token,
        )
        if (createBillErr || !newBill) {
          setState((s) => ({ ...s, session, bill: null, loading: false, error: 'Failed to create bill' }))
          return
        }
        bill = newBill
        await supabase
          .from('customer_sessions')
          .update({ bill_id: newBill.id })
          .setHeader('x-session-token', token)
          .eq('id', session.id)
        session = { ...session, bill_id: newBill.id }
      }
    }

    setState((s) => ({ ...s, session, bill, loading: false, error: null }))

    // 4. Make sure the bill has a waiter (idempotent, people-weighted)
    if (bill) assignWaiter(bill.id, token)
  }, [venueId, tableId, assignWaiter])

  useEffect(() => {
     
    const init = async () => {
      await ensureSession()
    }
    init()
  }, [ensureSession])

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
        .single()

      if (error) return { error: 'Failed to save party size' }

      const { error: billErr } = await db.updateBill(bill.id, { guest_count: partySize }, session.session_token)
      if (billErr) return { error: 'Failed to save party size' }

      setState((s) => ({
        ...s,
        session: { ...(updated as CustomerSession), bill_id: s.session?.bill_id ?? null },
        bill: bill ? { ...bill, guest_count: partySize } : bill,
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
