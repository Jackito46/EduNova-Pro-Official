
-- ==========================================================
-- SCRIPT DE RÉPARATION DISCIPLINE - EduNova v4.6
-- Résout l'erreur : "Could not find the table public.disciplinary_records"
-- ==========================================================

-- 1. S'assurer que les extensions nécessaires sont là
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Création de la table disciplinary_records
CREATE TABLE IF NOT EXISTS public.disciplinary_records (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('CONDUITE', 'RETARD', 'ABSENCE_NON_JUSTIFIEE', 'TRAVAIL_NON_FAIT', 'AUTRE')),
    description TEXT NOT NULL,
    sanction_type TEXT NOT NULL DEFAULT 'AUCUNE' CHECK (sanction_type IN ('AVERTISSEMENT', 'BLAME', 'RETENUE', 'EXCLUSION_TEMPORAIRE', 'EXCLUSION_DEFINITIVE', 'AUCUNE')),
    sanction_duration INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SIGNALÉ' CHECK (status IN ('SIGNALÉ', 'EN_COURS', 'CLOS', 'ANNULÉ')),
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indexation pour la performance
CREATE INDEX IF NOT EXISTS idx_disciplinary_school_id ON public.disciplinary_records(school_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_student_id ON public.disciplinary_records(student_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_academic_year ON public.disciplinary_records(academic_year_id);

-- 4. Activation de RLS
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS (Sécurité multi-tenant)
DROP POLICY IF EXISTS "Disciplinary view policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary view policy" ON public.disciplinary_records
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary insert policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary insert policy" ON public.disciplinary_records
    FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary update policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary update policy" ON public.disciplinary_records
    FOR UPDATE USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary delete policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary delete policy" ON public.disciplinary_records
    FOR DELETE USING (school_id = public.get_my_school_id());

-- 6. Attribution des droits
GRANT ALL ON public.disciplinary_records TO anon, authenticated, service_role;

-- 7. COMMANDE CRITIQUE : Force le rechargement immédiat du cache PostgREST
-- Cela résout l'erreur "Could not find the table in the schema cache"
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.disciplinary_records IS 'Table de suivi disciplinaire - Réparée le 11/04/2026';
