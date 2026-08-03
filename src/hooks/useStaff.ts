import { useCallback, useState } from 'react';
import { db, type DbStaffLookup, type DbStaffSession } from '../lib/api';
import { normalizeGhanaPhone } from '../lib/utils';

const SESSION_KEY = 'nightos:staff-session';

type StaffState = {
  /** Currently signed-in staff member (restored from localStorage). */
  staff: DbStaffSession | null;
  loading: boolean;
  error: string | null;
  /**
   * Step 1 — check the phone number. Returns null when no staff record
   * exists; otherwise tells the UI whether a PIN has been set already.
   */
  lookup: (phone: string) => Promise<DbStaffLookup | null>;
  /** Step 2a — first-time PIN setup (only works when no PIN exists yet). */
  setPin: (phone: string, pin: string) => Promise<boolean>;
  /** Step 2b — sign in with phone + own PIN. */
  signIn: (phone: string, pin: string) => Promise<DbStaffSession | null>;
  signOut: () => void;
};

function readStoredSession(): DbStaffSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.venue_id) return parsed as DbStaffSession;
  } catch {
    /* corrupted storage — treat as signed out */
  }
  return null;
}

export function useStaff(): StaffState {
  const [staff, setStaff] = useState<DbStaffSession | null>(() => readStoredSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (phone: string): Promise<DbStaffLookup | null> => {
    const normalized = normalizeGhanaPhone(phone);
    if (!normalized) {
      setError('Enter a valid Ghana phone number, e.g. 024 000 0000.');
      return null;
    }
    setLoading(true);
    setError(null);
    const { data, error: dbError } = await db.staffLookup(normalized);
    setLoading(false);
    if (dbError || !data) {
      setError('Staff not found — ask the manager to add you.');
      return null;
    }
    return data;
  }, []);

  const setPin = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    const normalized = normalizeGhanaPhone(phone);
    if (!normalized) return false;
    setLoading(true);
    setError(null);
    const { data, error: dbError } = await db.setStaffPin(normalized, pin);
    setLoading(false);
    if (dbError || data === false) {
      setError('Could not set your PIN. It must be 4–6 digits, and it can only be set once.');
      return false;
    }
    return true;
  }, []);

  const signIn = useCallback(async (phone: string, pin: string): Promise<DbStaffSession | null> => {
    const normalized = normalizeGhanaPhone(phone);
    if (!normalized) {
      setError('Enter a valid Ghana phone number, e.g. 024 000 0000.');
      return null;
    }
    setLoading(true);
    setError(null);
    const { data, error: dbError } = await db.staffSignIn(normalized, pin);
    setLoading(false);
    if (dbError || !data) {
      setError('Wrong phone or PIN. Try again.');
      return null;
    }
    setStaff(data);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable — session stays in memory only */
    }
    return data;
  }, []);

  const signOut = useCallback(() => {
    setStaff(null);
    setError(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { staff, loading, error, lookup, setPin, signIn, signOut };
}
