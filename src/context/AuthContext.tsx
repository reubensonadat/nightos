import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authDb } from '../lib/db/auth'
import type { DbVenue } from '../lib/api'

type AuthUser = import('@supabase/supabase-js').User
type Session = import('@supabase/supabase-js').Session

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
  isInitializing: boolean
  isAuthenticated: boolean
  hasVenue: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signInWithPhone: (phone: string) => Promise<{ error: any }>
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshVenue: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [venue, setVenue] = useState<DbVenue | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const currentUserIdRef = useRef<string | null>(null)

  const loadUserData = async (userId: string, userPhone: string | null = null) => {
    if (!userId) {
      setProfile(null)
      setVenue(null)
      setRole(null)
      return
    }

    const { data: v } = await authDb.venueByOwner(userId)
    if (v) {
      setVenue(v as DbVenue)
      setRole('owner')
    } else {
      const phoneToCheck = userPhone
      if (phoneToCheck) {
        const { data: staffData } = await authDb.venueByStaffPhone(phoneToCheck)
        if (staffData) {
          const sd = staffData as any
          setVenue(sd.venue as DbVenue)
          setRole(sd.role)
          return
        }
      }
      setVenue(null)
      setRole(null)
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
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserData(sess.user.id, sess.user.phone)
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
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error }
  }

  const verifyPhoneOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error }
    if (data.user) await loadUserData(data.user.id, data.user.phone)
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
  }

  const refreshVenue = async () => {
    if (!user?.id) return
    const { data: v } = await authDb.venueByOwner(user.id)
    setVenue((v as DbVenue) ?? null)
  }

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      venue,
      role,
      isInitializing,
      isAuthenticated: Boolean(user),
      hasVenue: Boolean(venue),
      signIn,
      signUp,
      signInWithPhone,
      verifyPhoneOtp,
      signOut,
      refreshVenue,
    }),
    [user, session, profile, venue, role, isInitializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
