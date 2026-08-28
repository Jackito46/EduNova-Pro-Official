-- MASTER ALIGNMENT V2: FORCE ALL school_id TO UUID & REPAIR VIEWS
-- This script fixes the "operator does not exist: uuid = text" AND dependency errors.

BEGIN;

-- 1. DROP DEPENDENT VIEWS (They block column type changes)
DROP VIEW IF EXISTS public.v_schools_with_counts CASCADE;
DROP VIEW IF EXISTS public.v_active_fee_plans CASCADE;

-- 2. Helper function for safe conversion (if not already exists)
CREATE OR REPLACE FUNCTION public.safe_to_uuid_v2(p_val ANYELEMENT)
RETURNS UUID AS $$
BEGIN
    IF p_val IS NULL THEN RETURN NULL; END IF;
    RETURN p_val::TEXT::UUID;
EXCEPTION WHEN OTHERS THEN
    -- Fallback on primary school ID
    RETURN 'a0ed9087-0554-40ae-ac26-86599a183b16'::UUID;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. CONVERT schools.id FIRST
-- We drop default first to avoid type mismatch in default expression
ALTER TABLE public.schools ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.schools ALTER COLUMN id TYPE UUID USING id::UUID;
ALTER TABLE public.schools ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();

-- 4. CONVERT ALL school_id COLUMNS
DO $$
DECLARE
    r RECORD;
    v_main_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
    FOR r IN 
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND (column_name = 'school_id')
          AND data_type != 'uuid'
    LOOP
        RAISE NOTICE 'Converting %.% to UUID...', r.table_name, r.column_name;
        
        -- Drop foreign keys linking to this column if they block it
        -- (Postgres might require dropping constraints manually if they are strict)
        
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE UUID USING public.safe_to_uuid_v2(%I)', r.table_name, r.column_name, r.column_name);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L::UUID', r.table_name, r.column_name, v_main_id);
    END LOOP;
END $$;

-- 5. RECREATE VIEWS
CREATE OR REPLACE VIEW public.v_schools_with_counts AS
SELECT 
  s.*,
  (SELECT count(*) FROM public.profiles p WHERE p.school_id = s.id) as profiles_count
FROM public.schools s;

CREATE OR REPLACE VIEW public.v_active_fee_plans AS
SELECT 
    fp.*,
    ay.label as year_label,
    c.name as class_name,
    c.level as class_level
FROM public.fee_plans fp
JOIN public.academic_years ay ON fp.academic_year_id = ay.id
JOIN public.classes c ON fp.class_id = c.id
WHERE ay.is_active = true;

GRANT SELECT ON public.v_schools_with_counts TO authenticated;
GRANT SELECT ON public.v_active_fee_plans TO authenticated;

-- 6. FIX SECURITY FUNCTIONS (Zero-Table approach)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false) OR
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) OR
    (auth.jwt() ->> 'email' = 'jackito46@gmail.com')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id text;
BEGIN
  v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
  IF v_id IS NULL OR v_id = '' THEN RETURN NULL; END IF;
  RETURN v_id::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END; $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
