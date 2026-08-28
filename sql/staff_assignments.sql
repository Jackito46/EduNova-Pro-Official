
-- ==========================================================
-- SCRIPT DE CRÉATION : GESTION DES AFFECTATIONS PERSONNEL
-- EduNova Pro v3.5
-- ==========================================================

-- 1. CRÉATION DE LA TABLE
CREATE TABLE IF NOT EXISTS public.staff_assignments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    subject_id TEXT, -- ID de la matière
    subject_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. INDEXATION POUR LA VITESSE DE LECTURE (Schedules/Emplois du temps)
CREATE INDEX IF NOT EXISTS idx_assignments_staff_id ON public.staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_assignments_day ON public.staff_assignments(day_of_week);

-- 3. ACTIVATION DE LA SÉCURITÉ RLS
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

-- 4. POLITIQUES DE SÉCURITÉ
-- Note : On utilise la jointure avec la table staff pour vérifier le school_id
-- Cela garantit que personne ne peut voir ou modifier les affectations d'une autre école.

DROP POLICY IF EXISTS "Assignments view policy" ON public.staff_assignments;
CREATE POLICY "Assignments view policy" ON public.staff_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = public.staff_assignments.staff_id 
            AND public.staff.school_id = public.get_my_school_id()
        )
    );

DROP POLICY IF EXISTS "Assignments manage policy" ON public.staff_assignments;
CREATE POLICY "Assignments manage policy" ON public.staff_assignments
    FOR ALL USING (
        public.is_admin() AND
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = public.staff_assignments.staff_id 
            AND public.staff.school_id = public.get_my_school_id()
        )
    );

-- 5. VÉRIFICATION DES CONTRAINTES
COMMENT ON TABLE public.staff_assignments IS 'Table stockant les heures de cours et interventions du personnel par classe.';
