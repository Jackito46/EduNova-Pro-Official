-- Refine RLS policies for academic_years and get_my_school_id function

BEGIN;

-- 1. Ensure get_user_school_id is robust (using plpgsql to avoid caching issues)
CREATE OR REPLACE FUNCTION public.get_user_school_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
  RETURN v_school_id;
END;
$$;

ALTER FUNCTION public.get_user_school_id(UUID) OWNER TO postgres;

-- 2. Ensure is_super_admin_safe is robust
CREATE OR REPLACE FUNCTION public.is_super_admin_safe(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
  INTO v_is_super_admin
  FROM auth.users
  WHERE id = p_user_id LIMIT 1;
  
  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

ALTER FUNCTION public.is_super_admin_safe(UUID) OWNER TO postgres;

-- 3. Ensure is_super_admin is robust
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_super_admin_safe(auth.uid());
END;
$$;

ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

-- 4. Ensure get_my_school_id is robust
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_user_school_id(auth.uid());
END;
$$;

ALTER FUNCTION public.get_my_school_id() OWNER TO postgres;

-- 5. Refine RLS for academic_years
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "AY View" ON public.academic_years;
DROP POLICY IF EXISTS "AY Manage" ON public.academic_years;
DROP POLICY IF EXISTS "AY SuperAdmin" ON public.academic_years;
DROP POLICY IF EXISTS "Enable read access for users in same school" ON public.academic_years;
DROP POLICY IF EXISTS "Enable insert access for users in same school" ON public.academic_years;
DROP POLICY IF EXISTS "Enable update access for users in same school" ON public.academic_years;
DROP POLICY IF EXISTS "Enable delete access for users in same school" ON public.academic_years;

-- Create new robust policies
CREATE POLICY "AY View" ON public.academic_years 
FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "AY Insert" ON public.academic_years 
FOR INSERT WITH CHECK (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "AY Update" ON public.academic_years 
FOR UPDATE USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "AY Delete" ON public.academic_years 
FOR DELETE USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
