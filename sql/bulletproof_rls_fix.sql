-- ==============================================================================
-- BULLETPROOF RLS FIX FOR "Database error querying schema" (Infinite Recursion)
-- ==============================================================================

-- 1. Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;

-- 2. Create the simplest, non-recursive policies for profiles
-- Since the app only ever queries the current user's profile, we ONLY need this:
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- 3. Redefine the helper functions to be extremely safe
-- We use SECURITY DEFINER to bypass RLS entirely inside these functions,
-- but even if RLS is triggered, the new profiles policy (id = auth.uid()) 
-- will evaluate instantly without calling any other functions.
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN v_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN COALESCE(v_is_super_admin, FALSE);
END; 
$$;

-- 4. Fix the schools policy just in case it's causing issues
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    public.is_super_admin() 
    OR id = public.get_my_school_id()
);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
