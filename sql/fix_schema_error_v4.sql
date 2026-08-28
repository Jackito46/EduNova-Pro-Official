-- Fix for Database error querying schema
BEGIN;

-- 1. Drop the problematic functions first
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin_safe(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_school_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_school_id(UUID) CASCADE;

-- 2. Create the functions using plpgsql instead of sql to avoid caching/schema issues
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

-- 3. Re-apply policies using the new functions
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;

CREATE POLICY "Profiles read own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles read superadmin" ON public.profiles FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Profiles read school" ON public.profiles FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Schools read own" ON public.schools;
DROP POLICY IF EXISTS "Schools read superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools update superadmin" ON public.schools;

CREATE POLICY "Schools read own" ON public.schools FOR SELECT USING (id = public.get_my_school_id());
CREATE POLICY "Schools read superadmin" ON public.schools FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Schools update superadmin" ON public.schools FOR UPDATE USING (public.is_super_admin());

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
