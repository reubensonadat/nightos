import { useState, useCallback, useRef, useEffect } from 'react'

export function useMutation<TData = unknown, TError = unknown, TArgs extends unknown[] = unknown[]>(
  mutator: (...args: TArgs) => Promise<{ data: TData | null; error: TError | null }>,
  options?: { onSuccess?: (data: TData) => void; onError?: (err: TError) => void },
) {
  const INITIAL = { data: null as TData | null, error: null as TError | null, loading: false }
  const [state, setState] = useState(INITIAL)
  const mutatorRef = useRef(mutator)
  const onSuccessRef = useRef(options?.onSuccess)
  const onErrorRef = useRef(options?.onError)

  useEffect(() => {
    mutatorRef.current = mutator
    onSuccessRef.current = options?.onSuccess
    onErrorRef.current = options?.onError
  })

  const mutate = useCallback(async (...args: TArgs) => {
    setState({ data: null, error: null, loading: true })
    try {
      const { data, error } = await mutatorRef.current(...args)
      if (error) throw error
      setState({ data, error: null, loading: false })
      if (data !== null) onSuccessRef.current?.(data)
      return { data, error: null }
    } catch (err) {
      const typedErr = err as TError
      setState({ data: null, error: typedErr, loading: false })
      onErrorRef.current?.(typedErr)
      return { data: null, error: typedErr }
    }
  }, [])
// eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reset = useCallback(() => setState(INITIAL), [])

  return { ...state, mutate, reset }
}
