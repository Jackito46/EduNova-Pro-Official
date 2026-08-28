-- ==============================================================================
-- FINAL RLS FIX FOR "Database error querying schema"
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Drop ALL policies on profiles and schools to clear any bad state
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles'; 
    END LOOP; 
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.schools'; 
    END LOOP; 
END $$;

-- 2. Recreate helper functions safely
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

-- Ensure functions are owned by postgres to bypass RLS
ALTER FUNCTION public.get_my_school_id() OWNER TO postgres;
ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

-- 3. Create non-recursive policies for profiles
-- Users can read their own profile
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- Users can read profiles in their school
CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (school_id = public.get_my_school_id());

-- Super admins can read all profiles
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (public.is_super_admin());

-- 4. Create non-recursive policies for schools
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    id = public.get_my_school_id() OR public.is_super_admin()
);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
