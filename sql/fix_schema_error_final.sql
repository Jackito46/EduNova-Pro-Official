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
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school admin" ON public.profiles;

DROP POLICY IF EXISTS "Schools read own" ON public.schools;
DROP POLICY IF EXISTS "Schools read superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools update superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
DROP POLICY IF EXISTS "Schools read" ON public.schools;
DROP POLICY IF EXISTS "Schools manage" ON public.schools;

-- 2. Recreate helper functions with LANGUAGE plpgsql to prevent inlining and infinite recursion
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

CREATE OR REPLACE FUNCTION public.is_super_admin_safe(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  BEGIN
    SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
    INTO v_is_super_admin
    FROM auth.users
    WHERE id = p_user_id LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_is_super_admin := false;
  END;
  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

-- 3. Create simple, bulletproof policies for profiles
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (school_id = public.get_user_school_id(auth.uid()));

-- 4. Create simple, bulletproof policies for schools
CREATE POLICY "Schools read own" ON public.schools
FOR SELECT USING (id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Schools read superadmin" ON public.schools
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Schools update superadmin" ON public.schools
FOR UPDATE USING (public.is_super_admin_safe(auth.uid()));

-- 5. Force schema cache reload
NOTIFY pgrst, 'reload schema';
