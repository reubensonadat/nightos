import { supabase } from '../supabase';

export const authDb = {
  profileById: (userId: string) =>
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),

  venueByOwner: (userId: string) =>
    supabase.from('venues').select('*').eq('owner_id', userId).maybeSingle(),

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
    supabase.from('venue_staff').select('*').eq('venue_id', venueId).order('created_at', { ascending: false }),

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
