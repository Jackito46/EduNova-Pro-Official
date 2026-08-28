-- ==============================================================================
-- ULTIMATE RLS REPAIR SCRIPT (No Recursion Guarantee)
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Drop ALL policies on profiles to clear the recursive loop
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles'; 
    END LOOP; 
END $$;

-- 2. Create the simplest, non-recursive policies for profiles
-- Users can ONLY read and update their OWN profile via standard queries.
-- This completely eliminates infinite recursion.
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Profiles insert school" ON public.profiles
FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

CREATE POLICY "Profiles update school" ON public.profiles
FOR UPDATE USING (school_id = public.get_my_school_id());

CREATE POLICY "Profiles delete school" ON public.profiles
FOR DELETE USING (school_id = public.get_my_school_id());

-- 3. Create RPC functions to safely fetch other profiles WITHOUT triggering RLS recursion
-- These functions bypass RLS and return exactly what is needed.

-- For School Admins to fetch their staff
CREATE OR REPLACE FUNCTION public.get_school_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN QUERY SELECT * FROM public.profiles WHERE school_id = v_school_id;
END;
$$;

-- For Super Admins to fetch school admins
CREATE OR REPLACE FUNCTION public.admin_get_school_admins(p_school_id UUID)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT is_super_admin INTO v_is_super_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  IF NOT COALESCE(v_is_super_admin, FALSE) THEN
    RAISE EXCEPTION 'Access denied: Super Admin only';
  END IF;
  
  RETURN QUERY SELECT * FROM public.profiles WHERE school_id = p_school_id AND role IN ('SCHOOL_ADMIN', 'DIRECTOR');
END;
$$;

-- 4. Fix the schools policy
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.schools'; 
    END LOOP; 
END $$;

CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    id = public.get_my_school_id() 
    OR public.is_super_admin()
);

CREATE POLICY "Schools update" ON public.schools
FOR UPDATE USING (
    id = public.get_my_school_id() 
    OR public.is_super_admin()
);

-- 5. Create a view for Super Admins to see school stats without RLS issues
CREATE OR REPLACE VIEW public.v_schools_with_counts AS
SELECT 
  s.*,
  (SELECT count(*) FROM public.profiles p WHERE p.school_id = s.id) as profiles_count
FROM public.schools s;

-- Grant access to the view
GRANT SELECT ON public.v_schools_with_counts TO authenticated;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
