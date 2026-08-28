-- Comprehensive Fix for Data Visibility and RLS
BEGIN;

-- 1. Ensure the helper functions are robust and don't cause recursion
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

-- 2. Fix Profiles and Schools RLS to prevent "Database error querying schema"
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles manage" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school admin" ON public.profiles;

CREATE POLICY "Profiles self access" ON public.profiles FOR SELECT USING (
  id = auth.uid()
);

CREATE POLICY "Profiles super admin" ON public.profiles FOR ALL USING (
  public.is_super_admin()
);

CREATE POLICY "Profiles school admin" ON public.profiles FOR SELECT USING (
  school_id = public.get_my_school_id()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools read" ON public.schools;
DROP POLICY IF EXISTS "Schools manage" ON public.schools;
DROP POLICY IF EXISTS "Schools super admin" ON public.schools;

CREATE POLICY "Schools read" ON public.schools FOR SELECT USING (
  id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Schools super admin" ON public.schools FOR ALL USING (
  public.is_super_admin()
);

-- 3. Fix Academic Years
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AY View" ON public.academic_years;
DROP POLICY IF EXISTS "AY Manage" ON public.academic_years;
DROP POLICY IF EXISTS "AY SuperAdmin" ON public.academic_years;

CREATE POLICY "AY View" ON public.academic_years FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "AY Manage" ON public.academic_years FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 4. Fix Classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Classes read" ON public.classes;
DROP POLICY IF EXISTS "Classes manage" ON public.classes;
DROP POLICY IF EXISTS "Classes total access" ON public.classes;
DROP POLICY IF EXISTS "Classes all" ON public.classes;

CREATE POLICY "Classes read" ON public.classes FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Classes manage" ON public.classes FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 5. Fix Subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subjects read" ON public.subjects;
DROP POLICY IF EXISTS "Subjects manage" ON public.subjects;

CREATE POLICY "Subjects read" ON public.subjects FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Subjects manage" ON public.subjects FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 6. Fix Students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students school isolation" ON public.students;
DROP POLICY IF EXISTS "Students isolation read" ON public.students;
DROP POLICY IF EXISTS "Students isolation manage" ON public.students;
DROP POLICY IF EXISTS "Manage school students" ON public.students;

CREATE POLICY "Students read" ON public.students FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Students manage" ON public.students FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 7. Fix Fee Plans
ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FP View" ON public.fee_plans;
DROP POLICY IF EXISTS "FP Manage" ON public.fee_plans;

CREATE POLICY "FP View" ON public.fee_plans FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "FP Manage" ON public.fee_plans FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 8. Fix Supply Catalog
ALTER TABLE public.supply_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog access" ON public.supply_catalog;

CREATE POLICY "Catalog read" ON public.supply_catalog FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Catalog manage" ON public.supply_catalog FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- 9. Link jomo2004@gmail.com to the main school
DO $$
DECLARE
  v_user_id UUID;
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
  -- Find the user ID for jomo2004@gmail.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jomo2004@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Update the profile to point to the main school
    UPDATE public.profiles
    SET school_id = v_main_school_id
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated jomo2004@gmail.com to school_id %', v_main_school_id;
  ELSE
    RAISE NOTICE 'User jomo2004@gmail.com not found';
  END IF;
END;
$$;

-- 10. Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
