import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

type NetworkContextValue = {
  isOnline: boolean
  isNetworkTimeout: boolean
  triggerGlobalSync: () => Promise<unknown>
  resolveGlobalSync: (success: boolean) => void
  clearNetworkTimeout: () => void
  syncCount: number
}

const NetworkContext = createContext<NetworkContextValue>(null!)

let globalLastAutoSync = 0
const AUTO_SYNC_THROTTLE_MS = 5 * 60 * 1000

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { status } = useNetworkStatus()
  const [isOnline, setIsOnline] = useState(status === 'online')
  const [isNetworkTimeout, setIsNetworkTimeout] = useState(false)
  const [syncCount, setSyncCount] = useState(0)

  const syncResolverRef = useRef<((value: unknown) => void) | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsOnline(status === 'online') }, [status])

  useEffect(() => {
    const tryAutoSync = () => {
      if (status !== 'online') return
      const now = Date.now()
      if (now - globalLastAutoSync < AUTO_SYNC_THROTTLE_MS) return
      globalLastAutoSync = now
      setSyncCount((c) => c + 1)
    }
    const handleFocus = () => tryAutoSync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tryAutoSync()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [status])

  const triggerGlobalSync = () => new Promise((resolve) => { syncResolverRef.current = resolve; setSyncCount((c) => c + 1) })

  const resolveGlobalSync = (success: boolean) => {
    syncResolverRef.current?.(success)
    syncResolverRef.current = null
  }

  const clearNetworkTimeout = () => setIsNetworkTimeout(false)

  return (
    <NetworkContext.Provider value={{ isOnline, isNetworkTimeout, triggerGlobalSync, resolveGlobalSync, clearNetworkTimeout, syncCount }}>
      {children}
    </NetworkContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used inside <NetworkProvider>')
  return ctx
}
