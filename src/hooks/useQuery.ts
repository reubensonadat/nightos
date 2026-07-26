import { useEffect, useRef, useState, useCallback } from 'react'

const INITIAL = { data: null as any, error: null as any, loading: true }

export function useQuery(
  fetcher: () => Promise<{ data: any; error: any }>,
  deps: unknown[] = [],
) {
  const [state, setState] = useState(INITIAL)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    if (!fetcherRef.current) return
    setState((prev: any) => ({ ...prev, loading: true }))
    try {
      const { data, error } = await fetcherRef.current()
      if (mountedRef.current) setState({ data, error, loading: false })
    } catch (err) {
      if (mountedRef.current) setState({ data: null, error: err, loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    refetch()
    return () => { mountedRef.current = false }
  }, [refetch])

  return { ...state, refetch } as { data: any; error: any; loading: boolean; refetch: () => Promise<void> }
}
