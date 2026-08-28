-- Ultimate RLS Fix for Login (No Recursion)
BEGIN;

-- 1. Drop all existing policies on profiles and schools to start fresh
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;

DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
DROP POLICY IF EXISTS "Schools update" ON public.schools;
DROP POLICY IF EXISTS "Schools read own" ON public.schools;
DROP POLICY IF EXISTS "Schools read superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools update superadmin" ON public.schools;

-- 2. Create a SECURITY DEFINER function to get the user's school ID without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_school_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

-- Ensure the function is owned by postgres so it bypasses RLS
ALTER FUNCTION public.get_user_school_id(UUID) OWNER TO postgres;

-- 3. Create simple, bulletproof policies for profiles
-- Users can always read their own profile
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Super admins can read all profiles
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'is_super_admin' = 'true'
    )
);

-- Users can read profiles in their own school (using the security definer function to avoid recursion)
CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
);

-- 4. Create simple, bulletproof policies for schools
-- Users can read their own school
CREATE POLICY "Schools read own" ON public.schools
FOR SELECT USING (
    id = public.get_user_school_id(auth.uid())
);

-- Super admins can read all schools
CREATE POLICY "Schools read superadmin" ON public.schools
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'is_super_admin' = 'true'
    )
);

-- Super admins can update all schools
CREATE POLICY "Schools update superadmin" ON public.schools
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'is_super_admin' = 'true'
    )
);

-- 5. Fix get_my_school_id to use the new safe function
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_school_id(auth.uid());
$$;

ALTER FUNCTION public.get_my_school_id() OWNER TO postgres;

COMMIT;
