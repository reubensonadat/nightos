import { supabase } from '../supabase';

export const authDb = {
  profileById: (userId: string) =>
    supabase
      .from('profiles')
      .select('id, email, phone_number, name, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle(),

  venueByOwner: (userId: string) =>
    supabase
      .from('venues')
      .select(
        'id, owner_id, name, slug, description, logo_url, address, phone, email, payment_model, service_charge_pct, vat_pct, tax_inclusive, currency, timezone, is_active, created_at, updated_at',
      )
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

  venueByStaffPhone: (phone: string) =>
    supabase.rpc('get_venue_by_staff_phone', { p_phone: phone }).maybeSingle(),

  checkPhoneExists: (phone: string) =>
    supabase.rpc('check_phone_exists', { p_phone: phone }),

  createVenue: (ownerId: string, name: string, slug: string) =>
    supabase.from('venues').insert({
      owner_id: ownerId,
      name,
      slug,
    }).select().single(),

  slugAvailable: (slug: string) =>
    supabase.from('venues').select('id', { count: 'exact', head: true }).eq('slug', slug),

  venueStaffByVenue: (venueId: string) =>
    supabase
      .from('venue_staff')
      .select('id, venue_id, phone_number, role, name, is_active, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false }),

  addVenueStaff: (venueId: string, phone: string, role: string, name?: string) =>
    supabase.from('venue_staff').insert({
      venue_id: venueId,
      phone_number: phone,
      role,
      name: name || null,
    }).select().single(),

  removeVenueStaff: (id: string) =>
    supabase.from('venue_staff').delete().eq('id', id),

  updateVenueStaffRole: (id: string, role: string) =>
    supabase.from('venue_staff').update({ role }).eq('id', id).select().single(),
};
