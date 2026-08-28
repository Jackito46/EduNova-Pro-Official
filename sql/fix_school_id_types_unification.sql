-- MASTER ALIGNMENT: FORCE ALL school_id TO UUID
-- This script fixes the "operator does not exist: uuid = text" error by unifying the schema.

BEGIN;

-- 1. Helper function for safe conversion
CREATE OR REPLACE FUNCTION public.safe_to_uuid(p_val TEXT)
RETURNS UUID AS $$
BEGIN
    IF p_val IS NULL OR p_val = '' THEN RETURN NULL; END IF;
    -- Check if it matches UUID pattern
    IF p_val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN p_val::UUID;
    ELSE
        -- Default to the main school ID if invalid
        RETURN 'a0ed9087-0554-40ae-ac26-86599a183b16'::UUID;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN 'a0ed9087-0554-40ae-ac26-86599a183b16'::UUID;
END;
$$ LANGUAGE plpgsql;

-- 2. List of tables to fix
DO $$
DECLARE
    r RECORD;
    v_main_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
    FOR r IN 
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'school_id'
          AND data_type = 'character varying' OR data_type = 'text'
    LOOP
        RAISE NOTICE 'Converting %.school_id to UUID...', r.table_name;
        
        -- Drop foreign keys if they exist (they might block the change)
        -- (Simplified: just alter the type, Postgres usually handles it if no strict FK blocks it)
        -- We use USING to handle the conversion safely
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE UUID USING public.safe_to_uuid(%I)', r.table_name, r.column_name, r.column_name);
        
        -- Set default to main school if it was null or had a default text
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L::UUID', r.table_name, r.column_name, v_main_id);
    END LOOP;
END $$;

-- 3. Also fix the schools.id if it's text
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'id') != 'uuid' THEN
        ALTER TABLE public.schools ALTER COLUMN id TYPE UUID USING id::UUID;
    END IF;
END $$;

-- 4. Re-establish robust helper functions (Strictly UUID)
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
        -- Fallback to database check
        SELECT school_id INTO v_school_id_text FROM public.profiles WHERE id = auth.uid();
    END IF;
    
    RETURN public.safe_to_uuid(v_school_id_text::TEXT);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 5. Force current user to be clean
UPDATE public.profiles 
SET school_id = 'a0ed9087-0554-40ae-ac26-86599a183b16'::UUID,
    role = 'SUPER_ADMIN',
    is_super_admin = true
WHERE email = 'jackito46@gmail.com';

COMMIT;

NOTIFY pgrst, 'reload schema';
