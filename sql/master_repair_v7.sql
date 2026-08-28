-- ==============================================================================
-- MASTER REPAIR SCRIPT V7 - THE FINAL STAND
-- This script performs a "Nuclear Cleanup" of all RLS policies and functions
-- to eliminate any possibility of recursion and fix the "Database error querying schema".
-- ==============================================================================

-- 1. Disable RLS on all tables to break any loops
DO $$ 
DECLARE 
    t RECORD;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename); 
    END LOOP; 
END $$;

-- 2. Drop ALL policies on ALL tables in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename); 
    END LOOP; 
END $$;

-- 3. Drop problematic views and functions
DROP VIEW IF EXISTS public.v_schools_with_counts CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin CASCADE;
DROP FUNCTION IF EXISTS public.get_my_school_id CASCADE;
DROP FUNCTION IF EXISTS public.get_user_school_id CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin_safe CASCADE;

-- 4. Recreate helper functions - PURE JWT BASED (No table queries)
-- This is the ONLY way to guarantee 100% no recursion.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- We ONLY trust the JWT metadata to avoid recursion
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
  v_id text;
BEGIN
  -- We ONLY trust the JWT metadata to avoid recursion
  v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
  IF v_id IS NULL OR v_id = '' THEN RETURN NULL; END IF;
  RETURN v_id::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 5. Re-enable RLS and apply clean policies
-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_all" ON public.profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "profiles_super_all" ON public.profiles FOR ALL USING (public.is_super_admin());
CREATE POLICY "profiles_school_select" ON public.profiles FOR SELECT USING (school_id = public.get_my_school_id());

-- SCHOOLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_select_all" ON public.schools FOR SELECT USING (true); -- Temporary allow select for all to fix login
CREATE POLICY "schools_modify_super" ON public.schools FOR ALL USING (public.is_super_admin());

-- 6. Generic policy for other tables
CREATE OR REPLACE FUNCTION public.apply_clean_rls(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    EXECUTE format('CREATE POLICY "isolation_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that exist and have school_id
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'school_id'
        AND table_name NOT IN ('profiles', 'schools', 'global_settings')
    LOOP 
        PERFORM public.apply_clean_rls(t);
    END LOOP; 
END $$;

-- 7. Recreate view
CREATE OR REPLACE VIEW public.v_schools_with_counts AS
SELECT 
  s.*,
  (SELECT count(*) FROM public.profiles p WHERE p.school_id = s.id) as profiles_count
FROM public.schools s;
GRANT SELECT ON public.v_schools_with_counts TO authenticated;

-- 8. Populate missing profiles from auth.users and Sync metadata
-- This ensures that even if profiles were lost, they are recreated from auth.users
CREATE OR REPLACE FUNCTION public.repair_and_sync_all()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r RECORD;
BEGIN
  -- A. Create missing profiles
  INSERT INTO public.profiles (id, email, full_name, role, is_super_admin, is_active, school_id)
  SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'role', 'STUDENT')::public.user_role,
    COALESCE((u.raw_user_meta_data->>'is_super_admin')::boolean, false),
    true,
    CASE 
      WHEN (u.raw_user_meta_data->>'school_id') IS NOT NULL 
           AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = (u.raw_user_meta_data->>'school_id')::uuid)
      THEN (u.raw_user_meta_data->>'school_id')::uuid
      ELSE NULL::uuid
    END
  FROM auth.users u
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id::uuid);

  -- B. Sync metadata back to auth.users for ALL users (Optimized)
  UPDATE auth.users u
  SET raw_user_meta_data = 
    COALESCE(u.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('school_id', p.school_id::text, 'is_super_admin', p.is_super_admin)
  FROM public.profiles p
  WHERE u.id = p.id;
END;
$$;

SELECT public.repair_and_sync_all();

-- Bootstrap the user as super admin
UPDATE public.profiles 
SET is_super_admin = true, role = 'SUPER_ADMIN'::public.user_role
WHERE email = 'jackito46@gmail.com';

-- Ensure paulnerjoseph@gmail.com is also a super admin or has correct role if needed
-- (Adjust this if they should be a school admin instead)
-- UPDATE public.profiles SET is_super_admin = true, role = 'SUPER_ADMIN' WHERE email = 'paulnerjoseph@gmail.com';

SELECT public.repair_and_sync_all();

-- 9. Fix the handle_new_user trigger to ensure it's not recursive and syncs metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
BEGIN
  -- Insertion du profil avec des valeurs par défaut sécurisées
  INSERT INTO public.profiles (id, email, full_name, role, is_super_admin, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'STUDENT')::public.user_role,
    COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, false),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    last_activity_at = now();

  -- Sync metadata back to auth.users to ensure it's in the JWT for RLS
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'school_id', new.raw_user_meta_data->>'school_id',
      'is_super_admin', COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, false)
    )
  WHERE id = new.id;

  RETURN new;
END;
$$;

NOTIFY pgrst, 'reload schema';
