
-- ==========================================================
-- SÉCURISATION NIVEAU LIGNE (RLS) - TABLE STUDENTS
-- EduNova Pro v4.7 - Protection des données sensibles
-- ==========================================================

-- 1. Activation de la sécurité
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students FORCE ROW LEVEL SECURITY;

-- 2. Nettoyage des anciennes politiques permissives
DROP POLICY IF EXISTS "Allow all for students" ON public.students;
DROP POLICY IF EXISTS "Students read access" ON public.students;

-- 3. Politique de lecture : Uniquement les élèves de MA propre école
CREATE POLICY "Students isolation read" ON public.students
    FOR SELECT USING (school_id = public.get_my_school_id());

-- 4. Politique de gestion : Seuls les admins de l'école peuvent modifier
CREATE POLICY "Students isolation manage" ON public.students
    FOR ALL USING (
        public.is_admin() AND 
        school_id = public.get_my_school_id()
    );

-- 5. Indexation pour performance
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);

COMMENT ON TABLE public.students IS 'Table sécurisée : isolation stricte par school_id.';
