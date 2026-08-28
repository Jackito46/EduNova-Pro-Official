-- DIAGNOSTIC: CHECK school_id TYPES
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '--- SCHEMA TYPE CHECK ---';
    FOR r IN 
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name IN ('school_id', 'id')
          AND table_name IN ('schools', 'profiles', 'academic_years', 'classes', 'subjects', 'students', 'fee_plans', 'payments', 'enrollments', 'supply_catalog')
    LOOP
        RAISE NOTICE 'Table: %, Column: %, Type: %', r.table_name, r.column_name, r.data_type;
    END LOOP;
    RAISE NOTICE '--- END CHECK ---';
END $$;
