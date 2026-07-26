import { useState, useCallback, useRef } from 'react'

const INITIAL = { data: null as any, error: null as any, loading: false }

export function useMutation(
  mutator: (...args: any[]) => Promise<{ data: any; error: any }>,
  options?: { onSuccess?: (data: any) => void; onError?: (err: any) => void },
) {
  const [state, setState] = useState(INITIAL)
  const mutatorRef = useRef(mutator)
  const onSuccessRef = useRef(options?.onSuccess)
  const onErrorRef = useRef(options?.onError)
  mutatorRef.current = mutator
  onSuccessRef.current = options?.onSuccess
  onErrorRef.current = options?.onError

  const mutate = useCallback(async (...args: any[]) => {
    setState({ data: null, error: null, loading: true })
    try {
      const { data, error } = await mutatorRef.current(...args)
      if (error) throw error
      setState({ data, error: null, loading: false })
      onSuccessRef.current?.(data)
      return { data, error: null }
    } catch (err) {
      setState({ data: null, error: err, loading: false })
      onErrorRef.current?.(err)
      return { data: null, error: err }
    }
  }, [])

  const reset = useCallback(() => setState(INITIAL), [])

  return { ...state, mutate, reset } as {
    data: any; error: any; loading: boolean
    mutate: (...args: any[]) => Promise<{ data: any; error: any }>
    reset: () => void
  }
}
