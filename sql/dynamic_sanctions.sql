-- Migration: Dynamic Disciplinary Sanctions
-- This script enables administrators to manage sanction types dynamically

-- 1. Create the sanction types table
CREATE TABLE IF NOT EXISTS public.disciplinary_sanction_types (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, name)
);

-- 2. Allow RLS for the new table
ALTER TABLE public.disciplinary_sanction_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sanction types view policy" ON public.disciplinary_sanction_types;
CREATE POLICY "Sanction types view policy" ON public.disciplinary_sanction_types
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Sanction types manage policy" ON public.disciplinary_sanction_types;
CREATE POLICY "Sanction types manage policy" ON public.disciplinary_sanction_types
    FOR ALL USING (public.is_admin() AND school_id = public.get_my_school_id());

-- 3. Seed default sanction types for existing schools
INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'AVERTISSEMENT', 'Avertissement formel' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'BLAME', 'Blâme officiel dans le dossier' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'RETENUE', 'Heures de retenue le soir ou le mercredi' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'EXCLUSION_TEMPORAIRE', 'Exclusion de l''établissement pour une durée déterminée' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'EXCLUSION_DEFINITIVE', 'Exclusion définitive de l''établissement' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

INSERT INTO public.disciplinary_sanction_types (school_id, name, description)
SELECT id, 'AUCUNE', 'Aucune sanction appliquée' FROM public.schools
ON CONFLICT (school_id, name) DO NOTHING;

-- 4. Remove the CHECK constraint on disciplinary_records.sanction_type
-- We find the constraint name first if it exists
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.disciplinary_records'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%sanction_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.disciplinary_records DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;
