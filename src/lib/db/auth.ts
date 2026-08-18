import { supabase } from '../supabase';

export const authDb = {
  venueByOwner: (userId: string) =>
    supabase
      .from('venues')
      .select(
        'id, owner_id, name, slug, description, logo_url, address, phone, email, payment_model, service_charge_pct, vat_pct, tax_inclusive, currency, timezone, is_active, created_at, updated_at, brand_primary, brand_secondary, brand_accent, brand_text_secondary, brand_danger, brand_light_blue',
      )
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

  venueByStaffPhone: (phone: string) =>
    supabase.rpc('get_venue_by_staff_phone', { p_phone: phone }).maybeSingle(),

  venueByPhone: (phone: string) =>
    supabase.rpc('venue_by_phone', { p_phone: phone }).maybeSingle(),

  checkPhoneExists: (phone: string) =>
    supabase.rpc('check_phone_exists', { p_phone: phone }),

  resolveLogin: (identifier: string) =>
    supabase.rpc('resolve_login', { identifier }).maybeSingle(),

  createVenue: (ownerId: string, name: string, slug: string) =>
    supabase.from('venues').insert({
      owner_id: ownerId,
      name,
      slug,
    }).select().single(),

  slugAvailable: (slug: string) =>
    supabase.from('venues').select('id', { count: 'exact', head: true }).eq('slug', slug),
};
