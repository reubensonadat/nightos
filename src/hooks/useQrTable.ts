import { useEffect, useState } from 'react'
import { db, type DbTable } from '../lib/api'

type QrState = {
  table: DbTable | null
  loading: boolean
  error: boolean
}

export function useQrTable(token: string | null) {
  const [state, setState] = useState<QrState>({ table: null, loading: false, error: false })

  useEffect(() => {
    if (!token) {
      setState({ table: null, loading: false, error: false })
      return
    }

    let cancelled = false

    async function resolve() {
      setState({ table: null, loading: true, error: false })
      const { data, error } = await db.tableByQrToken(token ?? '')
      if (cancelled) return
      if (error || !data) {
        setState({ table: null, loading: false, error: true })
        return
      }
      setState({ table: data, loading: false, error: false })
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [token])

  return state
}
