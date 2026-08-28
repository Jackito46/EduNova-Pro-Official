-- ==============================================================================
-- JWT-BASED RLS FIX (NON-RECURSIVE)
-- This script eliminates RLS recursion by using JWT metadata instead of table queries.
-- ==============================================================================

BEGIN;

-- 1. Redefine helper functions to use JWT metadata (No table hits = No recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false) OR
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_school_id_text TEXT;
BEGIN
  v_school_id_text := auth.jwt() -> 'user_metadata' ->> 'school_id';
  IF v_school_id_text IS NULL OR v_school_id_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_school_id_text::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.is_super_admin() OWNER TO postgres;
ALTER FUNCTION public.get_my_school_id() OWNER TO postgres;

-- 2. Update existing users metadata to ensure JWT has the required info
-- This function will sync profiles data back to auth.users metadata
CREATE OR REPLACE FUNCTION public.sync_all_users_metadata()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, school_id, is_super_admin FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object('school_id', r.school_id, 'is_super_admin', r.is_super_admin)
    WHERE id = r.id;
  END LOOP;
END;
$$;

SELECT public.sync_all_users_metadata();
DROP FUNCTION public.sync_all_users_metadata();

-- 3. Update the handle_new_user trigger to ensure metadata is always set
CREATE OR REPLACE FUNCTION public.on_profile_update_sync_metadata()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('school_id', new.school_id, 'is_super_admin', new.is_super_admin)
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_sync_metadata_trigger ON public.profiles;
CREATE TRIGGER on_profile_update_sync_metadata_trigger
AFTER UPDATE OF school_id, is_super_admin ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_profile_update_sync_metadata();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  -- Récupération de l'ID de l'école
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Vérification du flag super admin
  IF new.raw_user_meta_data->>'is_super_admin' = 'true' THEN
    v_is_super_admin := TRUE;
  END IF;

  -- Insertion du profil
  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    COALESCE(new.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
    v_school_id,
    v_is_super_admin,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    school_id = EXCLUDED.school_id,
    is_super_admin = EXCLUDED.is_super_admin;
  
  -- CRITICAL: Update the user's own metadata to ensure it's in the JWT
  -- We do this because the JWT is built from auth.users
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('school_id', v_school_id, 'is_super_admin', v_is_super_admin)
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- 4. RPC Functions for safe school switching (avoiding RLS issues on profiles)
CREATE OR REPLACE FUNCTION public.admin_switch_school(p_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Update profiles
  UPDATE public.profiles
  SET school_id = p_school_id
  WHERE id = auth.uid();
  
  -- 2. Update auth.users metadata to ensure JWT is updated on next login/refresh
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('school_id', p_school_id)
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_school_context()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Update profiles
  UPDATE public.profiles
  SET school_id = NULL
  WHERE id = auth.uid();
  
  -- 2. Update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) - 'school_id'
  WHERE id = auth.uid();
END;
$$;

ALTER FUNCTION public.admin_switch_school(UUID) OWNER TO postgres;
ALTER FUNCTION public.admin_reset_school_context() OWNER TO postgres;

-- 5. Apply clean, non-recursive RLS policies to PROFILES
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "Profiles self access" ON public.profiles
FOR ALL USING (id = auth.uid());

CREATE POLICY "Profiles super admin access" ON public.profiles
FOR ALL USING (public.is_super_admin());

-- For school members to see each other
-- Since get_my_school_id() uses JWT, this is NOT recursive!
CREATE POLICY "Profiles school access" ON public.profiles
FOR SELECT USING (
    school_id IS NOT NULL AND 
    school_id = public.get_my_school_id()
);

-- 5. Apply to other tables
CREATE OR REPLACE FUNCTION public.apply_jwt_rls(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY "Isolation %I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

SELECT public.apply_jwt_rls('academic_years');
SELECT public.apply_jwt_rls('classes');
SELECT public.apply_jwt_rls('subjects');
SELECT public.apply_jwt_rls('students');
SELECT public.apply_jwt_rls('fee_plans');
SELECT public.apply_jwt_rls('expense_categories');
SELECT public.apply_jwt_rls('expenses');
SELECT public.apply_jwt_rls('payments');
SELECT public.apply_jwt_rls('staff');
SELECT public.apply_jwt_rls('enrollments');
SELECT public.apply_jwt_rls('staff_assignments');
SELECT public.apply_jwt_rls('staff_attendances');
SELECT public.apply_jwt_rls('payroll_periods');
SELECT public.apply_jwt_rls('school_supplies');
SELECT public.apply_jwt_rls('supply_catalog');
SELECT public.apply_jwt_rls('audit_logs');
SELECT public.apply_jwt_rls('payroll_slips');
SELECT public.apply_jwt_rls('grades');
SELECT public.apply_jwt_rls('student_attendances');
SELECT public.apply_jwt_rls('salary_advances');

COMMIT;

NOTIFY pgrst, 'reload schema';
