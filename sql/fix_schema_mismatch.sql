-- Fix schema mismatches and RLS issues
DO $$ 
BEGIN
    -- 1. Add missing category column to subjects if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'category') THEN
        ALTER TABLE public.subjects ADD COLUMN category TEXT;
    END IF;

    -- 2. Ensure global_settings table is accessible for reading system status (maintenance mode)
    -- We allow authenticated and anon to read it so they can see if maintenance mode is on
    DROP POLICY IF EXISTS "Public read access for global_settings" ON public.global_settings;
    DROP POLICY IF EXISTS "Super admin full access for global_settings" ON public.global_settings;
    DROP POLICY IF EXISTS "Super Admin only access" ON public.global_settings;
    DROP POLICY IF EXISTS "Standard Isolation" ON public.global_settings;
    DROP POLICY IF EXISTS "isolation_global_settings" ON public.global_settings;
    
    ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Global Read Access" ON public.global_settings FOR SELECT USING (true);
    CREATE POLICY "Super Admin Manage All" ON public.global_settings FOR ALL USING (public.is_super_admin());

    -- 3. Fix seed_school_data to update schools.global_settings instead of inserting into global_settings table
END $$;

-- Update schools.global_settings for existing schools that might be missing it
UPDATE public.schools s
SET global_settings = jsonb_build_object(
    'currency', 'HTG',
    'school_name', s.name,
    'academic_year_id', (SELECT id FROM public.academic_years WHERE school_id::text = s.id::text AND is_active = true LIMIT 1)
)
WHERE global_settings IS NULL OR global_settings = '{}'::jsonb;
