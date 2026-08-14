import { useEffect, useRef, useState, useCallback } from 'react'

export function useQuery<TData = unknown, TError = unknown>(
  fetcher: () => Promise<{ data: TData | null; error: TError | null }>,
) {
  const INITIAL = { data: null as TData | null, error: null as TError | null, loading: true }
  const [state, setState] = useState(INITIAL)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const refetch = useCallback(async () => {
    if (!fetcherRef.current) return
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const { data, error } = await fetcherRef.current()
      if (mountedRef.current) setState({ data, error, loading: false })
    } catch (err) {
      if (mountedRef.current) setState({ data: null, error: err as TError, loading: false })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refetch()
    return () => { mountedRef.current = false }
  }, [refetch])

  return { ...state, refetch }
}
