-- ==============================================================================
-- 03-migrate-to-otp.sql
-- Run this to remove all the old custom PIN logic from your database.
-- ==============================================================================

-- 1. Drop the custom Auth RPCs
DROP FUNCTION IF EXISTS public.staff_sign_in(text, text);
DROP FUNCTION IF EXISTS public.set_staff_pin(text, text);
DROP FUNCTION IF EXISTS public.staff_lookup(text);

-- 2. Remove the PIN columns from the staff table
ALTER TABLE public.staff DROP COLUMN IF EXISTS pin;
ALTER TABLE public.staff DROP COLUMN IF EXISTS pin_hash;

-- 3. Add an RLS policy so Supabase Auth users can read their own staff row
DROP POLICY IF EXISTS "Staff can read their own profile via auth" ON public.staff;
CREATE POLICY "Staff can read their own profile via auth" ON public.staff
    FOR SELECT USING (
        -- Matches the phone number in auth.users to the phone number in staff
        phone = (SELECT raw_user_meta_data->>'phone' FROM auth.users WHERE id = auth.uid())
        OR 
        phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    );

-- 4. Reload PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
