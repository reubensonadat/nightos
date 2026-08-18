import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authDb } from '../lib/db/auth'
import type { DbVenue, DbStaffSession } from '../lib/api'

type AuthUser = import('@supabase/supabase-js').User
type Session = import('@supabase/supabase-js').Session
type AuthError = import('@supabase/supabase-js').AuthError

type Profile = {
  id: string
  email: string | null
  phone_number: string | null
  name: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  session: Session | null
  profile: Profile | null
  venue: DbVenue | null
  role: string | null
  staffSession: DbStaffSession | null
  isInitializing: boolean
  isAuthenticated: boolean
  hasVenue: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshVenue: () => Promise<void>
  refreshStaffSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>(null!)

/** Where a signed-in user belongs after OTP: owner/manager → manager, kitchen/bar →
 * kitchen display, everyone else on staff → the waiter dashboard. */
// eslint-disable-next-line react-refresh/only-export-components
export function sectorPath(role: string | null): string {
  if (role === 'owner' || role === 'manager' || role === 'supervisor') return '/manager'
  if (role === 'kitchen' || role === 'bar') return '/kitchen'
  return '/waiter'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [venue, setVenue] = useState<DbVenue | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [staffSession, setStaffSession] = useState<DbStaffSession | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const currentUserIdRef = useRef<string | null>(null)
  const lastPhoneRef = useRef<string | null>(null)

  const loadUserData = async (userId: string, userPhone: string | null = null) => {
    if (!userId) {
      setProfile(null)
      setVenue(null)
      setRole(null)
      setStaffSession(null)
      return
    }

    const { data: v } = await authDb.venueByOwner(userId)
    if (v) {
      setVenue(v as DbVenue)
      setRole('owner')
      setStaffSession(null)
    } else {
      const phoneToCheck = userPhone ?? lastPhoneRef.current
      if (phoneToCheck) {
        // Find staff
        const { data: staffData } = await authDb.venueByStaffPhone(phoneToCheck)
        if (staffData) {
          const sd = staffData as Record<string, unknown>
          setVenue(sd.venue as DbVenue)
          setRole(sd.role as string)

          // Also populate staffSession for App.tsx backward compatibility
          const { data, error } = await supabase.rpc('get_staff_profile_by_phone', { p_phone: phoneToCheck }).single();
          if (error) {
            console.warn('[AuthContext] get_staff_profile_by_phone failed:', error)
          }
          const fullStaffData = data as Record<string, unknown>;
            
          if (fullStaffData && fullStaffData.venue_id) {
             setStaffSession({
                id: fullStaffData.id as string,
                name: fullStaffData.name as string,
                role: fullStaffData.role as DbStaffSession['role'],
                venue_id: fullStaffData.venue_id as string,
                venue_name: fullStaffData.venue_name as string,
                venue_slug: fullStaffData.venue_slug as string,
                area_assignment: fullStaffData.area_assignment as string | null,
                max_tables: fullStaffData.max_tables as number,
             })

             // Auto clock-in — idempotent, so session reloads and token
             // refreshes reuse the existing active shift instead of stacking.
             ;(async () => {
               try { await supabase.rpc('clock_in_staff', { p_staff_id: fullStaffData.id }) } catch { /* non-fatal */ }
             })()
          }
          return
        }
      }
      setVenue(null)
      setRole(null)
      setStaffSession(null)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!mounted) return
      if (sess?.user) {
        currentUserIdRef.current = sess.user.id
        setUser(sess.user)
        setSession(sess)
        try {
          await loadUserData(sess.user.id, sess.user.phone)
        } catch (e) {
          console.error('[AuthContext] loadUserData failed on boot:', e)
        } finally {
          if (mounted) setIsInitializing(false)
        }
      } else {
        setIsInitializing(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      const newId = sess?.user?.id ?? null
      if (newId === currentUserIdRef.current && event !== 'SIGNED_OUT') return
      currentUserIdRef.current = newId

      if (!mounted) return

      setUser(sess?.user ?? null)
      setSession(sess ?? null)

      if (event === 'SIGNED_OUT' || !sess?.user) {
        setProfile(null)
        setVenue(null)
        setRole(null)
        setStaffSession(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserData(sess.user.id, sess.user.phone ?? lastPhoneRef.current)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    if (data.user) await loadUserData(data.user.id, data.user.phone)
    return { error: null }
  }

  const signInWithPhone = async (phone: string) => {
    lastPhoneRef.current = phone
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error }
  }

  const verifyPhoneOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error }
    if (data.user) {
      lastPhoneRef.current = phone
      await loadUserData(data.user.id, phone)
    }
    return { error: null }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/#/setup` },
    })
    if (error) return { error }
    if (data.user) {
      currentUserIdRef.current = data.user.id
      setUser(data.user)
      setSession(data.session)
      setProfile({ id: data.user.id, email, phone_number: null, name: null })
      setVenue(null)
      setRole(null)
      setStaffSession(null)
      try {
        await loadUserData(data.user.id, data.user.phone)
      } catch (e) {
        console.warn('[AuthContext] loadUserData after signUp failed:', e)
      }
    }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nightos:'))
      .forEach((k) => localStorage.removeItem(k))
    currentUserIdRef.current = null
    setUser(null)
    setSession(null)
    setProfile(null)
    setVenue(null)
    setRole(null)
    setStaffSession(null)
  }

  const refreshVenue = async () => {
    if (!user?.id) return
    const { data: v } = await authDb.venueByOwner(user.id)
    setVenue((v as DbVenue) ?? null)
  }

  const refreshStaffSession = async () => {
    if (!user?.id) return
    await loadUserData(user.id, user.phone)
  }

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      venue,
      role,
      staffSession,
      isInitializing,
      isAuthenticated: Boolean(user),
      hasVenue: Boolean(venue),
      signIn,
      signUp,
      signInWithPhone,
      verifyPhoneOtp,
      signOut,
      refreshVenue,
      refreshStaffSession
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, session, profile, venue, role, staffSession, isInitializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
