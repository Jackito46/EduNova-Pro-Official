
-- FIX STAFF_ASSIGNMENTS SCHEMA
DO $$ 
BEGIN 
    -- Add class_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_assignments' AND column_name='class_id') THEN
        ALTER TABLE public.staff_assignments ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
    END IF;

    -- Change subject_id to UUID if it's TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_assignments' AND column_name='subject_id' AND data_type='text') THEN
        -- We might need to handle existing data, but since it's empty or we can re-sync, we'll just cast it
        -- If there's data that isn't a UUID, this will fail, so we use a safe approach
        ALTER TABLE public.staff_assignments ALTER COLUMN subject_id TYPE UUID USING (CASE WHEN subject_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN subject_id::UUID ELSE NULL END);
        ALTER TABLE public.staff_assignments ADD CONSTRAINT staff_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
    END IF;
END $$;
