-- Definitive fix for profiles RLS
BEGIN;

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;

-- Create a SECURITY DEFINER function to get the user's school ID without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_school_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

ALTER FUNCTION public.get_user_school_id(UUID) OWNER TO postgres;

-- Create simple, bulletproof policies
-- 1. Users can ALWAYS read their own profile
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- 2. Users can ALWAYS update their own profile
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 3. Super admins can read all profiles
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'is_super_admin' = 'true'
    )
);

-- 4. Users can read profiles in their own school
CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
);

COMMIT;
