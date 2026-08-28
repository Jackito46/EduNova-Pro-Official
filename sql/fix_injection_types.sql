-- DEFINITIVE REPAIR FOR SEEDING TYPES
-- Fixes: operator does not exist: uuid = text

-- 1. Hardened seed_school_data
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_academic_year_id UUID;
BEGIN
    -- 1. Create or get an active academic year
    -- Using explicit casts to avoid "uuid = text" errors
    INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
    VALUES (p_school_id, '2025-2026', true, 'ACTIVE', '2025-09-01', '2026-06-30')
    ON CONFLICT (school_id, label) DO NOTHING
    RETURNING id INTO v_academic_year_id;

    IF v_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id 
        FROM public.academic_years 
        WHERE school_id = p_school_id AND is_active = true 
        LIMIT 1;
    END IF;

    -- 2. Create standard classes
    INSERT INTO public.classes (school_id, name, level)
    VALUES 
        (p_school_id, 'Petite Section', 'MATERNELLE'),
        (p_school_id, 'Moyenne Section', 'MATERNELLE'),
        (p_school_id, 'Grande Section', 'MATERNELLE'),
        (p_school_id, '1ère AF', 'FONDAMENTALE'),
        (p_school_id, '2ème AF', 'FONDAMENTALE'),
        (p_school_id, '3ème AF', 'FONDAMENTALE'),
        (p_school_id, '4ème AF', 'FONDAMENTALE'),
        (p_school_id, '5ème AF', 'FONDAMENTALE'),
        (p_school_id, '6ème AF', 'FONDAMENTALE'),
        (p_school_id, '7ème AF', 'FONDAMENTALE'),
        (p_school_id, '8ème AF', 'FONDAMENTALE'),
        (p_school_id, '9ème AF', 'FONDAMENTALE'),
        (p_school_id, 'NS I', 'SECONDAIRE'),
        (p_school_id, 'NS II', 'SECONDAIRE'),
        (p_school_id, 'NS III', 'SECONDAIRE'),
        (p_school_id, 'NS IV', 'SECONDAIRE')
    ON CONFLICT (school_id, name) DO NOTHING;

    -- 3. Create standard subjects
    INSERT INTO public.subjects (school_id, name, code, description)
    VALUES 
        (p_school_id, 'Initiation Mathématiques', 'INIT-MATH', 'Calcul élémentaire et formes'),
        (p_school_id, 'Langage et Communication', 'LANG-COMM', 'Expression orale et pré-lecture'),
        (p_school_id, 'Psychomotricité', 'PSYCHOMOT', 'Développement moteur'),
        (p_school_id, 'Arts et Dessin', 'ARTS-DESS', 'Expression artistique'),
        (p_school_id, 'Éveil Scientifique', 'EVEIL-SCI', 'Découverte du monde'),
        (p_school_id, 'Mathématiques Fondamentales', 'MATH-FOND', 'Arithmétique et Géométrie'),
        (p_school_id, 'Communication Française', 'FRAN-FOND', 'Grammaire et conjugaison'),
        (p_school_id, 'Communication Créole', 'CREO-FOND', 'Langue maternelle'),
        (p_school_id, 'Sciences Expérimentales', 'SCI-EXP', 'Physique/Chimie/Biologie'),
        (p_school_id, 'Sciences Sociales', 'SCI-SOC', 'Histoire et Géographie'),
        (p_school_id, 'Anglais', 'ANGL-GEN', 'Langue vivante 1'),
        (p_school_id, 'Espagnol', 'ESPA-GEN', 'Langue vivante 2'),
        (p_school_id, 'Informatique', 'INFO-TECH', 'Bureautique et algorithmes'),
        (p_school_id, 'Éducation Physique (EPS)', 'EPS-SPORT', 'Activités sportives'),
        (p_school_id, 'Physique-Chimie NS', 'PHY-CHI-NS', 'Programme secondaire supérieur'),
        (p_school_id, 'SVT / Biologie NS', 'SVT-NS', 'Sciences de la vie et de la terre'),
        (p_school_id, 'Philosophie', 'PHILO', 'Dissertation et réflexion'),
        (p_school_id, 'Économie et Société', 'ECONO', 'Introduction aux sciences économiques'),
        (p_school_id, 'Littérature Universelle', 'LITT-UNIV', 'Analyse d''œuvres classiques')
    ON CONFLICT (school_id, code) DO NOTHING;

    -- 4. Link subjects to classes (The most complex part where join errors happen)
    INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient)
    SELECT 
        p_school_id AS school_id,
        c.id AS class_id, 
        s.id AS subject_id,
        CASE 
            WHEN c.level = 'MATERNELLE' THEN 1
            WHEN c.level = 'FONDAMENTALE' THEN 2
            WHEN c.level = 'SECONDAIRE' THEN 4
            ELSE 1
        END AS coefficient
    FROM public.classes c
    CROSS JOIN public.subjects s
    WHERE c.school_id = p_school_id 
      AND s.school_id = p_school_id
      AND (
        (c.level = 'MATERNELLE' AND s.code IN ('INIT-MATH', 'LANG-COMM', 'PSYCHOMOT', 'ARTS-DESS', 'EVEIL-SCI'))
        OR
        (c.level = 'FONDAMENTALE' AND s.code IN ('MATH-FOND', 'FRAN-FOND', 'CREO-FOND', 'SCI-EXP', 'SCI-SOC', 'ANGL-GEN', 'INFO-TECH', 'EPS-SPORT'))
        OR
        (c.level = 'SECONDAIRE' AND s.code IN ('MATH-FOND', 'PHY-CHI-NS', 'SVT-NS', 'PHILO', 'ECONO', 'LITT-UNIV', 'ANGL-GEN', 'ESPA-GEN', 'INFO-TECH'))
      )
    ON CONFLICT (class_id, subject_id) DO NOTHING;

    -- 5. Create standard supply catalog items
    IF v_academic_year_id IS NOT NULL THEN
        INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category)
        VALUES 
            (p_school_id, v_academic_year_id, 'Uniforme Complet (Maternelle)', 3500, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Uniforme Complet (Fondamentale)', 4500, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Uniforme Complet (Secondaire)', 5500, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Veste Officielle (Graduation/Cérémonie)', 7500, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Tenue de Sport (EPS complet)', 2500, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Pack Livres : Cycle Maternelle', 8500, 'Manuel'),
            (p_school_id, v_academic_year_id, 'Pack Livres : 1e - 6e AF', 13500, 'Manuel'),
            (p_school_id, v_academic_year_id, 'Pack Livres : 7e - 9e AF', 16000, 'Manuel'),
            (p_school_id, v_academic_year_id, 'Pack Livres : Secondaire (NS1-NS4)', 22500, 'Manuel'),
            (p_school_id, v_academic_year_id, 'Livret de Préparation Examens d''État', 1500, 'Manuel'),
            (p_school_id, v_academic_year_id, 'Assurance Scolaire Annuelle', 1250, 'Service'),
            (p_school_id, v_academic_year_id, 'Badge d''Identification Magnétique', 1000, 'Service'),
            (p_school_id, v_academic_year_id, 'Accès Laboratoire Informatique (Frais)', 2500, 'Service'),
            (p_school_id, v_academic_year_id, 'Frais de Laboratoire Sciences (Chimie/Bio)', 3000, 'Service'),
            (p_school_id, v_academic_year_id, 'Abonnement Bibliothèque Numérique', 1500, 'Service'),
            (p_school_id, v_academic_year_id, 'Carnet de Liaison & Règlement Intérieur', 750, 'Fourniture'),
            (p_school_id, v_academic_year_id, 'Kit Géométrie Professionnel', 1250, 'Fourniture'),
            (p_school_id, v_academic_year_id, 'Blouse de Laboratoire Logotée', 2000, 'Fourniture')
        ON CONFLICT (school_id, academic_year_id, label) DO NOTHING;
    END IF;

    -- 6. Update school settings if needed
    UPDATE public.schools
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object(
        'currency', 'HTG',
        'academic_year_id', v_academic_year_id::TEXT
    )
    WHERE id = p_school_id;

END;
$$;

-- 2. Hardened admin_seed_existing_school
CREATE OR REPLACE FUNCTION public.admin_seed_existing_school(p_school_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    -- Ensure school exists
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Établissement introuvable.');
    END IF;

    PERFORM public.seed_school_data(p_school_id);
    
    RETURN jsonb_build_object('success', true, 'message', 'Données standards injectées avec succès.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_seed_existing_school(UUID) TO authenticated;
