import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uftbkgdyxwhrfplqtfcb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmdGJrZ2R5eHdocmZwbHF0ZmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTU0NjcsImV4cCI6MjA5NjU5MTQ2N30.rbPX0xZahvraegIeqqvgK4Cd_a5NDAX-SVjSWa4XRjo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const venueId = '7a8af35d-37e4-495c-83df-501b582458da'; // bs-resort
  
  const { data: tables } = await supabase.from('tables').select('*').eq('venue_id', venueId);
  const { data: products } = await supabase.from('products').select('*').eq('venue_id', venueId);
  
  console.log("Tables:", tables);
  console.log("Products:", products);
}

check();
