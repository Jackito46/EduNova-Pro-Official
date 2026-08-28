-- Fix staff table school_id type
DO $$
DECLARE
    v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
    -- 1. Update any invalid text values to the correct UUID
    UPDATE public.staff 
    SET school_id = v_main_school_id::text 
    WHERE school_id = 'school-2025-premium' OR school_id IS NULL;

    -- 2. Drop the text default
    ALTER TABLE public.staff ALTER COLUMN school_id DROP DEFAULT;

    -- 3. Change the column type to UUID
    ALTER TABLE public.staff ALTER COLUMN school_id TYPE UUID USING school_id::uuid;

    -- 4. Set the new default (optional, but good practice)
    -- ALTER TABLE public.staff ALTER COLUMN school_id SET DEFAULT 'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid;
END $$;
