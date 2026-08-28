-- ULTIMATE TYPE BULLETPROOF & RLS FIX
-- Version: 15.0
-- Target: Resolve 'operator does not exist: uuid = text' once and for all

DO $$ 
BEGIN
    -- 1. Helper for column existence
    CREATE OR REPLACE FUNCTION public.check_col_exists(t_name text, c_name text) RETURNS boolean AS $f$
    BEGIN
        RETURN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t_name AND column_name = c_name);
    END; $f$ LANGUAGE plpgsql;

    -- 2. Drop problem overloads
    DROP FUNCTION IF EXISTS public.admin_create_tenant(text, text, text, text, text) CASCADE;
    
    -- 3. Bulletproof is_super_admin
    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $f$
    DECLARE
        v_role text;
        v_email text;
    BEGIN
        -- Get data from JWT
        v_email := auth.jwt() ->> 'email';
        v_role := auth.jwt() -> 'user_metadata' ->> 'role';

        -- 1. Check email fallback (Jackito)
        IF v_email = 'jackito46@gmail.com' THEN
            RETURN TRUE;
        END IF;

        -- 2. Check JWT metadata
        IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN
            RETURN TRUE;
        END IF;

        -- 3. Check profiles table with explicit casting
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id::text = auth.uid()::text 
            AND role::text IN ('super_admin', 'SUPER_ADMIN')
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END; $f$;

    -- 4. Bulletproof get_my_school_id_safe
    CREATE OR REPLACE FUNCTION public.get_my_school_id_safe()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $f$
    DECLARE 
        v_id text;
        v_profile_school_id uuid;
    BEGIN
        -- Try JWT metadata first
        v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
        
        IF v_id IS NOT NULL AND v_id != '' THEN
            RETURN v_id;
        END IF;

        -- Fallback to profiles table
        SELECT school_id INTO v_profile_school_id
        FROM public.profiles
        WHERE id::text = auth.uid()::text;

        RETURN v_profile_school_id::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END; $f$;

    -- 5. Standard Isolation Policy Builder
    -- This handles EVERYTHING with ::text casting
    -- We use a single block for everything to avoid syntax issues
    DECLARE
        target_tables text[] := ARRAY[
            'profiles', 'academic_years', 'classes', 'subjects', 'students', 
            'enrollments', 'fee_plans', 'payments', 'supply_catalog', 
            'expenses', 'staff_assignments', 'global_settings', 
            'communication_settings', 'staff_attendances', 'staff_roles',
            'disciplinary_records', 'course_signatures', 'payment_gateways',
            'exchange_rates', 'payroll_slips', 'payroll_periods', 'salary_advances',
            'communication_logs', 'school_supplies', 'subscription_reminders',
            'class_schedules', 'subscription_history', 'audit_logs', 'resource_locks'
        ];
        tbl text;
    BEGIN
        FOREACH tbl IN ARRAY target_tables
        LOOP
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
                EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', tbl);
                EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', tbl);
                EXECUTE format('DROP POLICY IF EXISTS "Profiles Isolation" ON public.%I', tbl);
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
                
                -- Special case for profiles to allow self-access
                IF tbl = 'profiles' THEN
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.profiles
                        FOR ALL
                        USING (public.is_super_admin() OR id::text = auth.uid()::text OR school_id::text = public.get_my_school_id_safe())
                        WITH CHECK (public.is_super_admin() OR id::text = auth.uid()::text)
                    ');
                -- Standard school_id isolation
                ELSIF public.check_col_exists(tbl, 'school_id') THEN
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.%I
                        FOR ALL
                        USING (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                        WITH CHECK (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                    ', tbl);
                -- Fallback for tables without school_id (mostly for consistency)
                ELSE
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.%I
                        FOR ALL
                        USING (public.is_super_admin())
                        WITH CHECK (public.is_super_admin())
                    ', tbl);
                END IF;
            END IF;
        END LOOP;
    END;

    -- 6. Schools Table Policy (Uses 'id' instead of 'school_id')
    DROP POLICY IF EXISTS "Schools Isolation" ON public.schools;
    DROP POLICY IF EXISTS "Standard Isolation" ON public.schools;
    ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Standard Isolation" ON public.schools
    FOR ALL
    USING (public.is_super_admin() OR id::text = public.get_my_school_id_safe())
    WITH CHECK (public.is_super_admin());

    -- 7. Fix handle_new_user to be more robust with types
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, is_active)
      VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'STUDENT')::public.user_role,
        (new.raw_user_meta_data->>'school_id')::uuid,
        COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, FALSE),
        TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
        last_activity_at = now();
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

END $$;

NOTIFY pgrst, 'reload schema';
