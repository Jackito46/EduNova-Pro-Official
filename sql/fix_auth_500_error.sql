-- 1. Drop all policies to ensure a clean slate
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Schools read own" ON public.schools;
DROP POLICY IF EXISTS "Schools read superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools update superadmin" ON public.schools;

-- 2. Drop functions to recreate them cleanly
DROP FUNCTION IF EXISTS public.get_user_school_id(UUID);
DROP FUNCTION IF EXISTS public.is_super_admin_safe(UUID);

-- 3. Create extremely safe functions that cannot fail
CREATE OR REPLACE FUNCTION public.get_user_school_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
    RETURN v_school_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_safe(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
    INTO v_is_super_admin
    FROM auth.users
    WHERE id = p_user_id LIMIT 1;
    
    RETURN COALESCE(v_is_super_admin, false);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$;

-- 4. Check for and disable any problematic triggers on auth.users
-- We can't drop triggers on auth.users directly from here, but we can check if they exist
-- The most common issue is a trigger that updates the profile on login

-- 5. Create the simplest possible policies
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Schools read own" ON public.schools
FOR SELECT USING (id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Schools read superadmin" ON public.schools
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Schools update superadmin" ON public.schools
FOR UPDATE USING (public.is_super_admin_safe(auth.uid()));

-- 6. Force schema cache reload
NOTIFY pgrst, 'reload schema';
