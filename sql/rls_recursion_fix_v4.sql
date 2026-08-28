-- ===============================================================
-- RECURSION-SAFE RLS REPAIR (V4) - NO SUBQUERIES IN POLICIES
-- ===============================================================

-- 1. Ensure functions are definitely SECURITY DEFINER and robust
CREATE OR REPLACE FUNCTION public.get_my_school_id() 
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'school_id')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN (SELECT school_id FROM public.profiles WHERE id = auth.uid());
END; $$;

-- 2. Final Profiles Policy (NO SUBQUERIES)
DROP POLICY IF EXISTS "profiles_standard_access" ON public.profiles;
DROP POLICY IF EXISTS "Standard Isolation" ON public.profiles;
DROP POLICY IF EXISTS "profiles_isolation" ON public.profiles;

CREATE POLICY "profiles_standard_access" ON public.profiles
FOR ALL USING (
    id = auth.uid() OR 
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- 3. Final Schools Policy (NO SUBQUERIES)
DROP POLICY IF EXISTS "schools_standard_access" ON public.schools;
DROP POLICY IF EXISTS "Standard Isolation" ON public.schools;

CREATE POLICY "schools_standard_access" ON public.schools
FOR SELECT USING (
    public.is_super_admin() OR 
    id = public.get_my_school_id()
);

-- 4. Apply to other tables
DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('schools', 'profiles', 'global_settings')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "isolation_%I" ON public.%I', t, t);
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'school_id') THEN
            EXECUTE format('CREATE POLICY "isolation_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', t, t);
        END IF;
    END LOOP;
END $$;
