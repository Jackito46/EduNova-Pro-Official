DO $$ 
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
    col_exists boolean;
BEGIN
    FOREACH tbl IN ARRAY target_tables
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            -- Drop existing policies
            EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Profiles Isolation" ON public.%I', tbl);
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            
            -- Special case for profiles to allow self-access
            IF tbl = 'profiles' THEN
                EXECUTE '
                    CREATE POLICY "Standard Isolation" ON public.profiles
                    FOR ALL
                    USING (public.is_super_admin() OR id::text = auth.uid()::text OR school_id::text = public.get_my_school_id_safe())
                    WITH CHECK (public.is_super_admin() OR id::text = auth.uid()::text)
                ';
            ELSE
                -- Check if school_id column exists
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'school_id'
                ) INTO col_exists;

                IF col_exists THEN
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.%I
                        FOR ALL
                        USING (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                        WITH CHECK (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                    ', tbl);
                ELSE
                    -- If no school_id, only super admins can access (fallback)
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.%I
                        FOR ALL
                        USING (public.is_super_admin())
                        WITH CHECK (public.is_super_admin())
                    ', tbl);
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- Special handling for schools table (isolation on 'id')
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schools') THEN
        DROP POLICY IF EXISTS "Standard Isolation" ON public.schools;
        ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Standard Isolation" ON public.schools
        FOR ALL
        USING (public.is_super_admin() OR id::text = public.get_my_school_id_safe())
        WITH CHECK (public.is_super_admin());
    END IF;
END $$;
