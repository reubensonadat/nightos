-- ═════════════════════════════════════════════════════════════════════════════
-- 07 — Create Customer Profiles Table & RLS Policies
-- 
-- Fixes: 404 error when visiting CRM & Marketing.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    name text,
    phone text,
    email text,
    total_visits integer NOT NULL DEFAULT 1,
    total_spend numeric(12,2) NOT NULL DEFAULT 0.00,
    loyalty_tier text NOT NULL DEFAULT 'Bronze',
    is_vip boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customer_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT customer_profiles_venue_phone_key UNIQUE (venue_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_venue_id ON public.customer_profiles(venue_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_spend ON public.customer_profiles(venue_id, total_spend DESC);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Clean non-recursive policies
DROP POLICY IF EXISTS "customer_profiles_select" ON public.customer_profiles;
DROP POLICY IF EXISTS "customer_profiles_insert" ON public.customer_profiles;
DROP POLICY IF EXISTS "customer_profiles_update" ON public.customer_profiles;
DROP POLICY IF EXISTS "customer_profiles_delete" ON public.customer_profiles;

CREATE POLICY "customer_profiles_select" ON public.customer_profiles FOR SELECT USING (true);
CREATE POLICY "customer_profiles_insert" ON public.customer_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "customer_profiles_update" ON public.customer_profiles FOR UPDATE USING (true);
CREATE POLICY "customer_profiles_delete" ON public.customer_profiles FOR DELETE USING (public.is_venue_authorized(venue_id));

GRANT ALL ON public.customer_profiles TO anon, authenticated, service_role;
