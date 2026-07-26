import { useEffect, useState } from 'react';
import { db, type DbVenue } from '../lib/api';

const DEFAULT_VENUE: DbVenue = {
  id: '00000000-0000-0000-0000-000000000000',
  owner_id: '',
  name: 'Velvet Lounge',
  slug: 'velvet-lounge',
  description: 'Premium nightclub experience',
  logo_url: null,
  address: 'Accra, Ghana',
  phone: '+233 24 000 0000',
  email: 'hello@velvetlounge.gh',
  payment_model: 'POSTPAY',
  service_charge_pct: 10,
  vat_pct: 12.5,
  tax_inclusive: false,
  currency: 'GHS',
  timezone: 'Africa/Accra',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function useVenue(slug?: string) {
  const [venue, setVenue] = useState<DbVenue>(DEFAULT_VENUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await db.venueBySlug(slug);
      if (cancelled) return;
      if (err || !data) {
        setError('Could not load venue');
        setLoading(false);
        return;
      }
      setVenue(data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { venue, loading, error };
}
