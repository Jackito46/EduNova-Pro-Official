
-- ==========================================================
-- ARCHITECTURE ACADÉMIQUE - EduNova Pro v4.0
-- FIX : Script d'injection générique (SANS school_id codé en dur)
-- ==========================================================

-- INSTRUCTIONS :
-- 1. Allez dans votre table 'profiles' ou 'schools' pour récupérer votre ID d'école.
-- 2. Remplacez 'VOTRE_SCHOOL_ID' par cet ID dans le script ci-dessous.
-- 3. Exécutez le script dans l'éditeur SQL de Supabase.

DO $$ 
DECLARE 
    target_school_id UUID := 'VOTRE_SCHOOL_ID'; -- <--- REMPLACEZ ICI
BEGIN

    -- 1. Injection du catalogue global
    INSERT INTO public.subjects (school_id, name, code, description) VALUES 
    (target_school_id, 'Initiation Mathématiques', 'INIT-MATH', 'Calcul élémentaire et formes'),
    (target_school_id, 'Langage et Communication', 'LANG-COMM', 'Expression orale et pré-lecture'),
    (target_school_id, 'Psychomotricité', 'PSYCHOMOT', 'Développement moteur'),
    (target_school_id, 'Arts et Dessin', 'ARTS-DESS', 'Expression artistique'),
    (target_school_id, 'Éveil Scientifique', 'EVEIL-SCI', 'Découverte du monde'),
    (target_school_id, 'Mathématiques Fondamentales', 'MATH-FOND', 'Arithmétique et Géométrie'),
    (target_school_id, 'Communication Française', 'FRAN-FOND', 'Grammaire et conjugaison'),
    (target_school_id, 'Communication Créole', 'CREO-FOND', 'Langue maternelle'),
    (target_school_id, 'Sciences Expérimentales', 'SCI-EXP', 'Physique/Chimie/Biologie'),
    (target_school_id, 'Sciences Sociales', 'SCI-SOC', 'Histoire et Géographie'),
    (target_school_id, 'Anglais', 'ANGL-GEN', 'Langue vivante 1'),
    (target_school_id, 'Espagnol', 'ESPA-GEN', 'Langue vivante 2'),
    (target_school_id, 'Informatique', 'INFO-TECH', 'Bureautique et algorithmes'),
    (target_school_id, 'Éducation Physique (EPS)', 'EPS-SPORT', 'Activités sportives'),
    (target_school_id, 'Physique-Chimie NS', 'PHY-CHI-NS', 'Programme secondaire supérieur'),
    (target_school_id, 'SVT / Biologie NS', 'SVT-NS', 'Sciences de la vie et de la terre'),
    (target_school_id, 'Philosophie', 'PHILO', 'Dissertation et réflexion'),
    (target_school_id, 'Économie et Société', 'ECONO', 'Introduction aux sciences économiques'),
    (target_school_id, 'Littérature Universelle', 'LITT-UNIV', 'Analyse d''œuvres classiques')
    ON CONFLICT (school_id, code) DO NOTHING;

    -- 2. Liaison massive aux classes existantes
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
    WHERE c.school_id = target_school_id 
      AND s.school_id = target_school_id
      AND (
        (c.level = 'MATERNELLE' AND s.code IN ('INIT-MATH', 'LANG-COMM', 'PSYCHOMOT', 'ARTS-DESS', 'EVEIL-SCI'))
        OR
        (c.level = 'FONDAMENTALE' AND s.code IN ('MATH-FOND', 'FRAN-FOND', 'CREO-FOND', 'SCI-EXP', 'SCI-SOC', 'ANGL-GEN', 'INFO-TECH', 'EPS-SPORT'))
        OR
        (c.level = 'SECONDAIRE' AND s.code IN ('MATH-FOND', 'PHY-CHI-NS', 'SVT-NS', 'PHILO', 'ECONO', 'LITT-UNIV', 'ANGL-GEN', 'ESPA-GEN', 'INFO-TECH'))
      )
    ON CONFLICT (class_id, subject_id) DO NOTHING;

END $$;
