import { useEffect, useState } from 'react';
import { db, type DbVenue } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const DEFAULT_VENUE: DbVenue = {
  id: '00000000-0000-0000-0000-000000000000',
  owner_id: '',
  name: 'Your Venue',
  slug: '',
  description: 'Point of sale and venue operations',
  logo_url: null,
  address: '',
  phone: '',
  email: '',
  payment_model: 'POSTPAY',
  service_charge_pct: 0,
  vat_pct: 0,
  tax_inclusive: true,
  currency: 'GHS',
  timezone: 'Africa/Accra',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  brand_primary: null,
  brand_secondary: null,
  brand_accent: null,
  brand_text_secondary: null,
  brand_danger: null,
  brand_light_blue: null,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useVenue(slugOrId?: string) {
  let authVenue: DbVenue | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    authVenue = auth.venue;
  } catch {
    /* safely fallback when used outside AuthProvider */
  }

  const matchesAuth = Boolean(
    authVenue && slugOrId && (authVenue.id === slugOrId || authVenue.slug === slugOrId)
  );

  const initialVenue: DbVenue = matchesAuth
    ? authVenue!
    : (authVenue || DEFAULT_VENUE);

  const [venue, setVenue] = useState<DbVenue>(initialVenue);
  const [loading, setLoading] = useState<boolean>(!matchesAuth && Boolean(slugOrId));
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  useEffect(() => {
    // If matching active auth venue, update immediately
    if (authVenue && (slugOrId === authVenue.slug || slugOrId === authVenue.id)) {
      setVenue(authVenue);
      setLoading(false);
      setError(null);
      setIsNotFound(false);
      return;
    }

    if (!slugOrId) {
      setVenue(authVenue || DEFAULT_VENUE);
      setLoading(false);
      setError(null);
      setIsNotFound(false);
      return;
    }

    let cancelled = false;

    async function load(identifier: string) {
      setLoading(true);
      setError(null);
      setIsNotFound(false);

      const isUuid = UUID_REGEX.test(identifier);
      const { data, error: err } = isUuid
        ? await db.venueById(identifier)
        : await db.venueBySlug(identifier);

      if (cancelled) return;
      if (err || !data) {
        setVenue(DEFAULT_VENUE);
        setError(`Venue "${identifier}" not found`);
        setIsNotFound(true);
        setLoading(false);
        return;
      }
      setVenue(data);
      setError(null);
      setIsNotFound(false);
      setLoading(false);
    }

    load(slugOrId);
    return () => {
      cancelled = true;
    };
  }, [slugOrId, authVenue]);

  return { venue, loading, error, isNotFound };
}
