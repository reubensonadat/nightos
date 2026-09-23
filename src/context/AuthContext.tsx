import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authDb } from '../lib/db/auth'
import { cacheClear } from '../lib/cache'
import { clearMenuCache } from '../screens/waiter/OrderManagementScreen'
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
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; role: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>
  signUpWithPhone: (phone: string) => Promise<{ error: AuthError | null }>
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: AuthError | null; role: string | null }>
  signOut: () => Promise<void>
  refreshVenue: () => Promise<void>
  refreshStaffSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>(null!)

/** Where a signed-in user belongs after OTP: owner/manager → manager, kitchen/bar →
 * kitchen display, everyone else on staff → the waiter dashboard. */
// eslint-disable-next-line react-refresh/only-export-components
export function sectorPath(role: string | null, venueSlug?: string | null): string {
  const prefix = venueSlug ? `/v/${venueSlug}` : '';
  if (role === 'owner' || role === 'manager') return `${prefix}/manager/ops`;
  if (role === 'kitchen' || role === 'bar') return `${prefix}/kitchen`;
  return `${prefix}/waiter`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function isAllowedForTarget(role: string | null, target: string): boolean {
  if (!role) return false
  if (target.startsWith('/kitchen')) {
    return role === 'owner' || role === 'manager' || role === 'kitchen' || role === 'bar'
  }
  if (target.startsWith('/waiter')) {
    return role === 'owner' || role === 'manager' || role === 'waiter'
  }
  if (target.startsWith('/manager')) {
    return role === 'owner' || role === 'manager'
  }
  return true
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

  const loadUserData = async (
    userId: string,
    userPhone: string | null = null,
    userEmail: string | null = null,
  ): Promise<string | null> => {
    if (!userId) {
      setProfile(null)
      setVenue(null)
      setRole(null)
      setStaffSession(null)
      return null
    }

    // 1. Check if user owns a venue
    const { data: v } = await authDb.venueByOwner(userId)
    if (v) {
      const venueObj = v as DbVenue
      setVenue(venueObj)
      setRole('owner')
      setStaffSession(null)
      setProfile({
        id: userId,
        email: userEmail ?? (venueObj.email || null),
        phone_number: userPhone ?? (venueObj.phone || null),
        name: venueObj.name || null,
      })
      return 'owner'
    }

    // 2. Check if phone is linked to staff or venue
    const rawPhone = userPhone?.trim() || null
    if (rawPhone) {
      const { data: staffData } = await authDb.venueByStaffPhone(rawPhone)
      if (staffData) {
        const sd = staffData as Record<string, unknown>
        setVenue(sd.venue as DbVenue)
        setRole(sd.role as string)

        const { data, error } = await supabase
          .rpc('get_staff_profile_by_phone', { p_phone: rawPhone })
          .single()
        if (error) {
          console.warn('[AuthContext] get_staff_profile_by_phone failed:', error)
        }
        const fullStaffData = data as Record<string, unknown>

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
          setProfile({
            id: userId,
            email: (fullStaffData.email as string) || userEmail,
            phone_number: (fullStaffData.phone as string) || rawPhone,
            name: fullStaffData.name as string,
          })

          try {
            await supabase.rpc('clock_in_staff', { p_staff_id: fullStaffData.id })
          } catch {
            /* non-fatal */
          }
        }
        return sd.role as string
      }

      // Check if owner by phone
      const { data: ownerByPhone } = await authDb.venueByPhone(rawPhone)
      if (ownerByPhone) {
        const od = ownerByPhone as Record<string, unknown>
        const venueObj = od.venue as DbVenue
        setVenue(venueObj)
        setRole('owner')
        setStaffSession(null)
        setProfile({
          id: userId,
          email: userEmail ?? (venueObj.email || null),
          phone_number: rawPhone,
          name: venueObj.name || null,
        })
        return 'owner'
      }
    }

    // 3. Check if user matches a staff row by email
    const rawEmail = userEmail?.trim() || null
    if (rawEmail) {
      const { data: staffByEmail } = await supabase
        .from('staff')
        .select('id, name, phone, email, role, venue_id, is_active, area_assignment, max_tables, venues!inner(*)')
        .ilike('email', rawEmail)
        .eq('is_active', true)
        .maybeSingle()

      if (staffByEmail && staffByEmail.venue_id) {
        const venueObj = staffByEmail.venues as unknown as DbVenue
        setVenue(venueObj)
        setRole(staffByEmail.role)
        setStaffSession({
          id: staffByEmail.id,
          name: staffByEmail.name,
          role: staffByEmail.role as DbStaffSession['role'],
          venue_id: staffByEmail.venue_id,
          venue_name: venueObj.name,
          venue_slug: venueObj.slug,
          area_assignment: staffByEmail.area_assignment,
          max_tables: staffByEmail.max_tables,
        })
        setProfile({
          id: userId,
          email: rawEmail,
          phone_number: staffByEmail.phone,
          name: staffByEmail.name,
        })

        try {
          await supabase.rpc('clock_in_staff', { p_staff_id: staffByEmail.id })
        } catch {
          /* non-fatal */
        }

        return staffByEmail.role
      }

      // Check if venue matches email
      const { data: venueByEmail } = await supabase
        .from('venues')
        .select('*')
        .ilike('email', rawEmail)
        .eq('is_active', true)
        .maybeSingle()

      if (venueByEmail) {
        const venueObj = venueByEmail as DbVenue
        setVenue(venueObj)
        setRole('owner')
        setStaffSession(null)
        setProfile({
          id: userId,
          email: rawEmail,
          phone_number: venueObj.phone || null,
          name: venueObj.name || null,
        })
        return 'owner'
      }
    }

    setVenue(null)
    setRole(null)
    setStaffSession(null)
    return null
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
          await loadUserData(sess.user.id, sess.user.phone, sess.user.email)
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
        currentUserIdRef.current = null
        lastPhoneRef.current = null
        setProfile(null)
        setVenue(null)
        setRole(null)
        setStaffSession(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserData(sess.user.id, sess.user.phone, sess.user.email)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    cacheClear()
    clearMenuCache()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error, role: null }
    if (data.user) {
      currentUserIdRef.current = data.user.id
      setUser(data.user)
      setSession(data.session)
      const resolved = await loadUserData(data.user.id, data.user.phone, email)
      return { error: null, role: resolved }
    }
    return { error: null, role: null }
  }

  const signInWithPhone = async (phone: string) => {
    lastPhoneRef.current = phone
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error }
  }

  const signUpWithPhone = async (phone: string) => {
    lastPhoneRef.current = phone
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error }
  }

  const signInWithOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login` },
    })
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    return { error }
  }

  const verifyPhoneOtp = async (phone: string, token: string) => {
    cacheClear()
    clearMenuCache()
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error, role: null }
    if (data.user) {
      currentUserIdRef.current = data.user.id
      lastPhoneRef.current = phone
      setUser(data.user)
      setSession(data.session)
      const resolved = await loadUserData(data.user.id, phone, data.user.email)
      return { error: null, role: resolved }
    }
    return { error: null, role: null }
  }

  const signUp = async (email: string, password: string) => {
    cacheClear()
    clearMenuCache()
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
        await loadUserData(data.user.id, data.user.phone, email)
      } catch (e) {
        console.warn('[AuthContext] loadUserData after signUp failed:', e)
      }
    }
    return { error: null }
  }

  const signOut = async () => {
    // 1. Clock out active staff member if present
    try {
      if (staffSession?.id) {
        await supabase.rpc('clock_out_staff', { p_staff_id: staffSession.id })
      }
    } catch (e) {
      console.warn('[AuthContext] clock_out_staff error on sign out:', e)
    }

    // 2. Invalidate Supabase session safely (global first, fallback to local)
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (e) {
        console.warn('[AuthContext] Supabase signOut error:', e)
      }
    }

    // 3. Clear cache and in-memory caches
    try {
      cacheClear()
    } catch {
      /* ignore */
    }
    try {
      clearMenuCache()
    } catch {
      /* ignore */
    }

    // 4. Purge localStorage completely for any app / auth tokens
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (
          k &&
          (k.startsWith('nightos:') ||
            k.startsWith('bysen:') ||
            k.startsWith('sb-') ||
            k.includes('auth-token'))
        ) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k)
        } catch {
          /* ignore */
        }
      })
    } catch (e) {
      console.warn('[AuthContext] Error purging localStorage:', e)
    }

    // 5. Purge sessionStorage completely
    try {
      const sessionKeysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (
          k &&
          (k.startsWith('nightos:') ||
            k.startsWith('bysen:') ||
            k.startsWith('sb-') ||
            k.includes('auth-token') ||
            k.includes('otp_pending'))
        ) {
          sessionKeysToRemove.push(k)
        }
      }
      sessionKeysToRemove.forEach((k) => {
        try {
          sessionStorage.removeItem(k)
        } catch {
          /* ignore */
        }
      })
    } catch (e) {
      console.warn('[AuthContext] Error purging sessionStorage:', e)
    }

    // 6. Purge IndexedDB databases if accessible
    if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.databases) {
      try {
        const dbs = await window.indexedDB.databases()
        for (const dbInfo of dbs) {
          if (
            dbInfo.name &&
            (dbInfo.name.includes('supabase') ||
              dbInfo.name.includes('nightos') ||
              dbInfo.name.includes('bysen'))
          ) {
            window.indexedDB.deleteDatabase(dbInfo.name)
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 7. Reset all React state & refs
    currentUserIdRef.current = null
    lastPhoneRef.current = null
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
    await loadUserData(user.id, user.phone, user.email)
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
      signUpWithPhone,
      signInWithOAuth,
      resetPassword,
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
