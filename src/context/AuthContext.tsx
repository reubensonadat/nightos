import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authDb } from '../lib/db/auth'
import { db, type DbVenue, type DbStaffSession } from '../lib/api'
import { cacheClear } from '../lib/cache'
import { clearMenuCache } from '../screens/waiter/OrderManagementScreen'
import { applyBrandTheme } from '../lib/theme'

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
  venues: DbVenue[]
  switchVenue: (venueId: string) => void
  role: string | null
  staffSession: DbStaffSession | null
  isInitializing: boolean
  isAuthenticated: boolean
  hasVenue: boolean
  signIn: (email: string, password: string, targetVenueSlug?: string | null) => Promise<{ error: AuthError | null; role: string | null; venueSlug: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>
  signUpWithPhone: (phone: string) => Promise<{ error: AuthError | null }>
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  verifyPhoneOtp: (phone: string, token: string, targetVenueSlug?: string | null) => Promise<{ error: AuthError | null; role: string | null; venueSlug: string | null }>
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
  if (role === 'bar') return `${prefix}/bar`;
  if (role === 'kitchen') return `${prefix}/kitchen`;
  return `${prefix}/waiter`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function isAllowedForTarget(role: string | null, target: string): boolean {
  if (!role) return false
  if (target.startsWith('/kitchen') || target.startsWith('/bar')) {
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
  const [venues, setVenues] = useState<DbVenue[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [staffSession, setStaffSession] = useState<DbStaffSession | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const currentUserIdRef = useRef<string | null>(null)
  const lastPhoneRef = useRef<string | null>(null)
  /** In-flight loadUserData dedupe — see the loadUserData wrapper below. */
  const loadInflightRef = useRef<{ userId: string; p: Promise<{ role: string | null; venueSlug: string | null }> } | null>(null)

  const extractUserName = (u?: AuthUser | null, email?: string | null): string => {
    const meta = u?.user_metadata
    if (meta?.full_name && typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim()
    if (meta?.name && typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim()
    if (meta?.first_name && typeof meta.first_name === 'string' && meta.first_name.trim()) {
      return `${meta.first_name} ${meta.last_name || ''}`.trim()
    }
    if (email && email.includes('@')) {
      const username = email.split('@')[0]
      return username.charAt(0).toUpperCase() + username.slice(1)
    }
    return 'Manager'
  }

  const performLoadUserData = async (
    userId: string,
    userPhone: string | null = null,
    userEmail: string | null = null,
    authUser?: AuthUser | null,
    targetVenueSlugOrId?: string | null,
  ): Promise<{ role: string | null; venueSlug: string | null }> => {
    if (!userId) {
      setProfile(null)
      setVenue(null)
      setVenues([])
      setRole(null)
      setStaffSession(null)
      return { role: null, venueSlug: null }
    }

    const currentAuthUser = authUser || user
    const resolvedPersonName = extractUserName(currentAuthUser, userEmail)

    // 0. Auto-claim venue ownership if authenticated user's phone matches venue phone
    try {
      await supabase.rpc('claim_venue_ownership')
    } catch {
      /* non-fatal */
    }

    // Determine preferred venue from argument, URL, or local storage
    const pathMatch = window.location.pathname.match(/\/v\/([^/]+)/)
    const effectiveTarget = targetVenueSlugOrId || (pathMatch ? pathMatch[1] : null)

    const rawPhone = (
      userPhone?.trim() ||
      user?.phone?.trim() ||
      (user?.user_metadata?.phone as string | undefined)?.trim() ||
      (user?.user_metadata?.phone_number as string | undefined)?.trim() ||
      lastPhoneRef.current?.trim() ||
      null
    )
    const rawEmail = userEmail?.trim() || null

    /** Resolve an active staff membership by phone (optionally venue-scoped).
     *  STAFF is the stronger signal: a phone on both a staff row and a venue
     *  row belongs to staff — waiters, bartenders and kitchen must never
     *  resolve as owner. Commits role/venue/staffSession state, clocks in,
     *  and returns the resolution, or null when no staff row matches. */
    const resolveStaffByPhone = async (
      phone: string,
      scope: string | null,
    ): Promise<{ role: string | null; venueSlug: string | null } | null> => {
      const { data: staffData } = await authDb.venueByStaffPhone(phone, scope)
      if (!staffData) return null
      const sd = staffData as Record<string, unknown>
      const v = sd.venue as DbVenue
      setVenue(v)
      setVenues(v ? [v] : [])
      setRole(sd.role as string)

      const { data } = await supabase
        .rpc('get_staff_profile_by_phone', {
          p_phone: phone,
          ...(scope ? { p_venue_slug: scope } : {}),
        })
        .single()
      const fullStaffData = data as Record<string, unknown>
      const resolvedSlug = (fullStaffData?.venue_slug as string) || v?.slug || null

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
          phone_number: (fullStaffData.phone as string) || phone,
          name: (fullStaffData.name as string) || resolvedPersonName,
        })

        try {
          await supabase.rpc('clock_in_staff', { p_staff_id: fullStaffData.id })
        } catch {
          /* non-fatal */
        }
      }
      if (v?.brand_primary || v?.brand_accent) {
        applyBrandTheme(v.brand_primary, v.brand_accent, v.brand_secondary);
      }
      return { role: sd.role as string, venueSlug: resolvedSlug }
    }

    /** Resolve an active staff membership by email (optionally venue-scoped). */
    const resolveStaffByEmail = async (
      email: string,
      scope: string | null,
    ): Promise<{ role: string | null; venueSlug: string | null } | null> => {
      let staffQuery = supabase
        .from('staff')
        .select('id, name, phone, email, role, venue_id, is_active, area_assignment, max_tables, venues!inner(*)')
        .ilike('email', email)
        .eq('is_active', true)

      if (scope) {
        staffQuery = staffQuery.or(`slug.eq.${scope},id.eq.${scope}`, { referencedTable: 'venues' })
      }

      const { data: staffByEmail } = await staffQuery.maybeSingle()
      if (!staffByEmail || !staffByEmail.venue_id) return null

      const venueObj = staffByEmail.venues as unknown as DbVenue
      setVenue(venueObj)
      setVenues(venueObj ? [venueObj] : [])
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
        email: email,
        phone_number: staffByEmail.phone,
        name: staffByEmail.name || resolvedPersonName,
      })

      try {
        await supabase.rpc('clock_in_staff', { p_staff_id: staffByEmail.id })
      } catch {
        /* non-fatal */
      }

      return { role: staffByEmail.role, venueSlug: venueObj.slug }
    }

    // 1. Venue-scoped intent (/v/<slug>/login or an explicit target): a
    //    staff row at THAT venue outranks the user's own venues. Without
    //    this, an owner doing waiter duty at another venue is always
    //    hijacked back to the venue they own (the velvet-lounge incident).
    if (effectiveTarget) {
      if (rawPhone) {
        const scoped = await resolveStaffByPhone(rawPhone, effectiveTarget)
        if (scoped) return scoped
      }
      if (rawEmail) {
        const scoped = await resolveStaffByEmail(rawEmail, effectiveTarget)
        if (scoped) return scoped
      }
    }

    // 2. Check if user owns venues (support multi-venue switching)
    const { data: vList } = await authDb.venuesByOwner(userId)
    if (vList && vList.length > 0) {
      const ownerVenues = vList as DbVenue[]
      setVenues(ownerVenues)
      const savedId = localStorage.getItem('nightos:active_venue_id')
      const active = (effectiveTarget && ownerVenues.find((x) => x.slug === effectiveTarget || x.id === effectiveTarget))
        || ownerVenues.find((x) => x.id === savedId)
        || ownerVenues[0]
      setVenue(active)
      setRole('owner')
      setStaffSession(null)
      setProfile({
        id: userId,
        email: userEmail ?? (active.email || null),
        phone_number: userPhone ?? (active.phone || null),
        name: resolvedPersonName,
      })
      if (active.brand_primary || active.brand_accent) {
        applyBrandTheme(active.brand_primary, active.brand_accent, active.brand_secondary);
      }
      return { role: 'owner', venueSlug: active.slug }
    }

    // 3. Check if phone is linked to staff or venue
    if (rawPhone) {
      const staffResolved = await resolveStaffByPhone(rawPhone, effectiveTarget)
      if (staffResolved) return staffResolved

      // Owner by venue phone (weaker signal — only reached when the number
      // is on no staff row of this venue)
      const { data: ownerByPhone } = await authDb.venueByPhone(rawPhone, effectiveTarget)
      if (ownerByPhone) {
        const od = ownerByPhone as Record<string, unknown>
        const venueObj = od.venue as DbVenue
        setVenue(venueObj)
        setVenues([venueObj])
        setRole('owner')
        setStaffSession(null)
        setProfile({
          id: userId,
          email: userEmail ?? (venueObj.email || null),
          phone_number: rawPhone,
          name: resolvedPersonName,
        })
        if (venueObj.brand_primary || venueObj.brand_accent) {
          applyBrandTheme(venueObj.brand_primary, venueObj.brand_accent, venueObj.brand_secondary);
        }
        return { role: 'owner', venueSlug: venueObj.slug }
      }
    }

    // 4. Check if user matches a staff row by email
    if (rawEmail) {
      const staffByEmailResolved = await resolveStaffByEmail(rawEmail, effectiveTarget)
      if (staffByEmailResolved) return staffByEmailResolved

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
        setVenues([venueObj])
        setRole('owner')
        setStaffSession(null)
        setProfile({
          id: userId,
          email: rawEmail,
          phone_number: venueObj.phone || null,
          name: resolvedPersonName,
        })
        return { role: 'owner', venueSlug: venueObj.slug }
      }
    }

    // 5. No match: an authenticated user who owns no venue and sits on no
    //    staff roster gets NO role — never a silent manager grant over
    //    someone's venue. The auth screen surfaces this and signs them out.
    //    Do NOT wipe previously resolved state here: a transient resolution
    //    miss must not revoke an already-committed session (sign-out clears
    //    state explicitly).
    return { role: null, venueSlug: null }
  }

  /** Serialises concurrent resolutions for the same user: the SIGNED_IN
   *  auth event races the login handler's own loadUserData call, and two
   *  interleaved runs could wipe just-committed role/staffSession state
   *  (the "bounced back to login" race). Same-user calls share one flight. */
  const loadUserData = (
    userId: string,
    userPhone: string | null = null,
    userEmail: string | null = null,
    authUser?: AuthUser | null,
    targetVenueSlugOrId?: string | null,
  ): Promise<{ role: string | null; venueSlug: string | null }> => {
    if (loadInflightRef.current && loadInflightRef.current.userId === userId) {
      return loadInflightRef.current.p
    }
    const p = performLoadUserData(userId, userPhone, userEmail, authUser, targetVenueSlugOrId).finally(() => {
      if (loadInflightRef.current?.p === p) loadInflightRef.current = null
    })
    loadInflightRef.current = { userId, p }
    return p
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

      if (event === 'SIGNED_OUT' || !sess?.user) {
        currentUserIdRef.current = null
        lastPhoneRef.current = null
        setUser(null)
        setSession(null)
        setProfile(null)
        setVenue(null)
        setRole(null)
        setStaffSession(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserData(sess.user.id, sess.user.phone, sess.user.email)
        setUser(sess.user)
        setSession(sess)
      } else {
        setUser(sess?.user ?? null)
        setSession(sess ?? null)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string, targetVenueSlug?: string | null) => {
    cacheClear()
    clearMenuCache()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error, role: null, venueSlug: null }
    if (data.user) {
      currentUserIdRef.current = data.user.id
      const resolved = await loadUserData(data.user.id, data.user.phone, email, undefined, targetVenueSlug)
      setUser(data.user)
      setSession(data.session)
      return { error: null, role: resolved.role, venueSlug: resolved.venueSlug }
    }
    return { error: null, role: null, venueSlug: null }
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

  const verifyPhoneOtp = async (phone: string, token: string, targetVenueSlug?: string | null) => {
    cacheClear()
    clearMenuCache()
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error, role: null, venueSlug: null }
    if (data.user) {
      currentUserIdRef.current = data.user.id
      lastPhoneRef.current = phone
      const resolved = await loadUserData(data.user.id, phone, data.user.email, undefined, targetVenueSlug)
      setUser(data.user)
      setSession(data.session)
      return { error: null, role: resolved.role, venueSlug: resolved.venueSlug }
    }
    return { error: null, role: null, venueSlug: null }
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
    setVenues([])
    setRole(null)
    setStaffSession(null)
    try {
      localStorage.removeItem('nightos:active_venue_id')
    } catch {
      /* ignore */
    }
  }

  const switchVenue = useCallback((venueId: string) => {
    setVenues((prev) => {
      const found = prev.find((v) => v.id === venueId)
      if (found) {
        setVenue(found)
        try {
          localStorage.setItem('nightos:active_venue_id', found.id)
        } catch {
          /* ignore */
        }
      }
      return prev
    })
  }, [])

  const refreshVenue = async () => {
    // 1. If we already have an active venue, fetch fresh data by ID directly
    if (venue?.id) {
      const { data: refreshedVenue } = await db.venueById(venue.id);
      if (refreshedVenue) {
        setVenue(refreshedVenue);
        if (refreshedVenue.brand_primary || refreshedVenue.brand_accent) {
          applyBrandTheme(refreshedVenue.brand_primary, refreshedVenue.brand_accent, refreshedVenue.brand_secondary);
        }
        return;
      }
    }

    if (!user?.id) return;
    const { data: vList } = await authDb.venuesByOwner(user.id);
    if (vList && vList.length > 0) {
      const ownerVenues = vList as DbVenue[];
      setVenues(ownerVenues);
      const savedId = localStorage.getItem('nightos:active_venue_id');
      const active = ownerVenues.find((x) => x.id === savedId) || ownerVenues[0];
      setVenue(active);
      if (active.brand_primary || active.brand_accent) {
        applyBrandTheme(active.brand_primary, active.brand_accent, active.brand_secondary);
      }
    } else {
      const { data: v } = await authDb.venueByOwner(user.id);
      if (v) {
        setVenue(v as DbVenue);
        if ((v as DbVenue).brand_primary || (v as DbVenue).brand_accent) {
          applyBrandTheme((v as DbVenue).brand_primary, (v as DbVenue).brand_accent, (v as DbVenue).brand_secondary);
        }
      }
    }
  };

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
      venues,
      switchVenue,
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
      refreshStaffSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, session, profile, venue, venues, switchVenue, role, staffSession, isInitializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
