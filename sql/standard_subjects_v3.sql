
-- ==========================================================
-- ARCHITECTURE ACADÉMIQUE COMPLÈTE - EduNova Pro v3.6
-- FIX : Création de table + Injection robuste des matières
-- ==========================================================

-- 1. CRÉATION DE LA TABLE DE LIAISON (MATIÈRES PAR CLASSE)
CREATE TABLE IF NOT EXISTS public.class_subjects (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    coefficient NUMERIC DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, subject_id)
);

-- Activation RLS pour la liaison
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class subjects view" ON public.class_subjects;
CREATE POLICY "Class subjects view" ON public.class_subjects
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Class subjects manage" ON public.class_subjects;
CREATE POLICY "Class subjects manage" ON public.class_subjects
    FOR ALL USING (true); -- En production, filtrer par school_id via jointure

-- 2. INJECTION DU CATALOGUE GLOBAL DES MATIÈRES (Standard National/International)
INSERT INTO public.subjects (school_id, name, code, description) VALUES 
('school-2025-premium', 'Initiation Mathématiques', 'INIT-MATH', 'Calcul élémentaire et formes'),
('school-2025-premium', 'Langage et Communication', 'LANG-COMM', 'Expression orale et pré-lecture'),
('school-2025-premium', 'Psychomotricité', 'PSYCHOMOT', 'Développement moteur'),
('school-2025-premium', 'Arts et Dessin', 'ARTS-DESS', 'Expression artistique'),
('school-2025-premium', 'Éveil Scientifique', 'EVEIL-SCI', 'Découverte du monde'),
('school-2025-premium', 'Mathématiques Fondamentales', 'MATH-FOND', 'Arithmétique et Géométrie'),
('school-2025-premium', 'Communication Française', 'FRAN-FOND', 'Grammaire et conjugaison'),
('school-2025-premium', 'Communication Créole', 'CREO-FOND', 'Langue maternelle'),
('school-2025-premium', 'Sciences Expérimentales', 'SCI-EXP', 'Physique/Chimie/Biologie'),
('school-2025-premium', 'Sciences Sociales', 'SCI-SOC', 'Histoire et Géographie'),
('school-2025-premium', 'Anglais', 'ANGL-GEN', 'Langue vivante 1'),
('school-2025-premium', 'Espagnol', 'ESPA-GEN', 'Langue vivante 2'),
('school-2025-premium', 'Informatique', 'INFO-TECH', 'Bureautique et algorithmes'),
('school-2025-premium', 'Éducation Physique (EPS)', 'EPS-SPORT', 'Activités sportives'),
('school-2025-premium', 'Physique-Chimie NS', 'PHY-CHI-NS', 'Programme secondaire supérieur'),
('school-2025-premium', 'SVT / Biologie NS', 'SVT-NS', 'Sciences de la vie et de la terre'),
('school-2025-premium', 'Philosophie', 'PHILO', 'Dissertation et réflexion'),
('school-2025-premium', 'Économie et Société', 'ECONO', 'Introduction aux sciences économiques'),
('school-2025-premium', 'Littérature Universelle', 'LITT-UNIV', 'Analyse d''œuvres classiques')
ON CONFLICT (school_id, code) DO NOTHING;

-- 3. LIAISON MASSIVE ET INTELLIGENTE (Correction du scope CTE)
-- On utilise un seul INSERT avec des conditions pour dispatcher les matières selon le niveau
INSERT INTO public.class_subjects (class_id, subject_id, coefficient)
SELECT 
    c.id AS class_id, 
    s.id AS subject_id,
    CASE 
        WHEN c.level = 'MATERNELLE' THEN 1
        WHEN c.level = 'FONDAMENTALE' THEN 2
        WHEN c.level = 'SECONDAIRE' THEN 4
        ELSE 1
    END AS coefficient
FROM public.classes c, public.subjects s
WHERE c.school_id = 'school-2025-premium' 
  AND s.school_id = 'school-2025-premium'
  AND (
    -- Dispatcher Maternelle
    (c.level = 'MATERNELLE' AND s.code IN ('INIT-MATH', 'LANG-COMM', 'PSYCHOMOT', 'ARTS-DESS', 'EVEIL-SCI'))
    OR
    -- Dispatcher Fondamentale
    (c.level = 'FONDAMENTALE' AND s.code IN ('MATH-FOND', 'FRAN-FOND', 'CREO-FOND', 'SCI-EXP', 'SCI-SOC', 'ANGL-GEN', 'INFO-TECH', 'EPS-SPORT'))
    OR
    -- Dispatcher Secondaire
    (c.level = 'SECONDAIRE' AND s.code IN ('MATH-FOND', 'PHY-CHI-NS', 'SVT-NS', 'PHILO', 'ECONO', 'LITT-UNIV', 'ANGL-GEN', 'ESPA-GEN', 'INFO-TECH'))
  )
ON CONFLICT (class_id, subject_id) DO NOTHING;
