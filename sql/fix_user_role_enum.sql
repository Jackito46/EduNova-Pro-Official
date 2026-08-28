DO $$
DECLARE
    role_name text;
    roles text[] := ARRAY['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'SECRETARY', 'ACCOUNTANT', 'TEACHER', 'SUPERVISOR', 'LIBRARIAN', 'STUDENT', 'PARENT'];
BEGIN
    FOREACH role_name IN ARRAY roles
    LOOP
        BEGIN
            EXECUTE format('ALTER TYPE user_role ADD VALUE IF NOT EXISTS %L', role_name);
        EXCEPTION
            WHEN duplicate_object THEN
                -- Value already exists, ignore
                NULL;
            WHEN undefined_object THEN
                -- Type user_role doesn't exist? Let's create it if it doesn't exist
                -- But wait, if it doesn't exist, the above would fail differently.
                RAISE NOTICE 'Type user_role might not exist';
        END;
    END LOOP;
END $$;
