-- ==========================================================
-- DYNAMIC SESSION CREATION & SEEDING UPDATE
-- ==========================================================

-- 1. Helper function to determine the current system academic year
CREATE OR REPLACE FUNCTION public.get_default_academic_session_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config jsonb;
    v_current_month INT;
    v_current_year INT;
    v_start_year INT;
    v_end_year INT;
    v_label TEXT;
BEGIN
    -- Try to get from global settings first
    SELECT value INTO v_config FROM public.global_settings WHERE key = 'default_session_config';
    
    IF v_config IS NOT NULL THEN
        RETURN v_config;
    END IF;

    -- Fallback to dynamic calculation
    v_current_month := EXTRACT(MONTH FROM now());
    v_current_year := EXTRACT(YEAR FROM now());

    -- Logic: before June (6), we are in the session that started last year
    -- After June (6), we are starting the new session
    IF v_current_month < 6 THEN
        v_start_year := v_current_year - 1;
        v_end_year := v_current_year;
    ELSE
        v_start_year := v_current_year;
        v_end_year := v_current_year + 1;
    END IF;

    v_label := v_start_year::TEXT || '-' || v_end_year::TEXT;

    RETURN jsonb_build_object(
        'label', v_label,
        'start_date', (v_start_year::TEXT || '-09-01'),
        'end_date', (v_end_year::TEXT || '-06-30')
    );
END;
$$;

-- 2. Update seed_school_data to use dynamic logic
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_academic_year_id UUID;
    v_session_config jsonb;
BEGIN
    -- Get dynamic or configured session data
    v_session_config := public.get_default_academic_session_config();

    -- 1. Create an active academic year if none exists
    IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE school_id::TEXT = p_school_id::TEXT AND is_active = true) THEN
        INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
        VALUES (
            p_school_id::TEXT, 
            v_session_config->>'label', 
            true, 
            'ACTIVE', 
            CASE 
                WHEN (v_session_config->>'start_date') IS NULL OR (v_session_config->>'start_date') = '' THEN (EXTRACT(YEAR FROM now())::TEXT || '-09-01')::DATE
                ELSE (v_session_config->>'start_date')::DATE
            END,
            CASE 
                WHEN (v_session_config->>'end_date') IS NULL OR (v_session_config->>'end_date') = '' THEN ((EXTRACT(YEAR FROM now()) + 1)::TEXT || '-06-30')::DATE
                ELSE (v_session_config->>'end_date')::DATE
            END
        )
        RETURNING id INTO v_academic_year_id;
    ELSE
        SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id::TEXT = p_school_id::TEXT AND is_active = true LIMIT 1;
    END IF;

    -- 2. Create standard classes
    INSERT INTO public.classes (school_id, name, level)
    VALUES 
        (p_school_id::TEXT, 'Petite Section', 'MATERNELLE'),
        (p_school_id::TEXT, 'Moyenne Section', 'MATERNELLE'),
        (p_school_id::TEXT, 'Grande Section', 'MATERNELLE'),
        (p_school_id::TEXT, '1ère AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '2ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '3ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '4ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '5ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '6ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '7ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '8ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, '9ème AF', 'FONDAMENTALE'),
        (p_school_id::TEXT, 'NS I', 'SECONDAIRE'),
        (p_school_id::TEXT, 'NS II', 'SECONDAIRE'),
        (p_school_id::TEXT, 'NS III', 'SECONDAIRE'),
        (p_school_id::TEXT, 'NS IV', 'SECONDAIRE')
    ON CONFLICT (school_id, name) DO NOTHING;

    -- 3. Create standard subjects
    INSERT INTO public.subjects (school_id, name, code, description)
    VALUES 
        (p_school_id::TEXT, 'Initiation Mathématiques', 'INIT-MATH', 'Calcul élémentaire et formes'),
        (p_school_id::TEXT, 'Langage et Communication', 'LANG-COMM', 'Expression orale et pré-lecture'),
        (p_school_id::TEXT, 'Psychomotricité', 'PSYCHOMOT', 'Développement moteur'),
        (p_school_id::TEXT, 'Arts et Dessin', 'ARTS-DESS', 'Expression artistique'),
        (p_school_id::TEXT, 'Éveil Scientifique', 'EVEIL-SCI', 'Découverte du monde'),
        (p_school_id::TEXT, 'Mathématiques Fondamentales', 'MATH-FOND', 'Arithmétique et Géométrie'),
        (p_school_id::TEXT, 'Communication Française', 'FRAN-FOND', 'Grammaire et conjugaison'),
        (p_school_id::TEXT, 'Communication Créole', 'CREO-FOND', 'Langue maternelle'),
        (p_school_id::TEXT, 'Sciences Expérimentales', 'SCI-EXP', 'Physique/Chimie/Biologie'),
        (p_school_id::TEXT, 'Sciences Sociales', 'SCI-SOC', 'Histoire et Géographie'),
        (p_school_id::TEXT, 'Anglais', 'ANGL-GEN', 'Langue vivante 1'),
        (p_school_id::TEXT, 'Espagnol', 'ESPA-GEN', 'Langue vivante 2'),
        (p_school_id::TEXT, 'Informatique', 'INFO-TECH', 'Bureautique et algorithmes'),
        (p_school_id::TEXT, 'Éducation Physique (EPS)', 'EPS-SPORT', 'Activités sportives'),
        (p_school_id::TEXT, 'Physique-Chimie NS', 'PHY-CHI-NS', 'Programme secondaire supérieur'),
        (p_school_id::TEXT, 'SVT / Biologie NS', 'SVT-NS', 'Sciences de la vie et de la terre'),
        (p_school_id::TEXT, 'Philosophie', 'PHILO', 'Dissertation et réflexion'),
        (p_school_id::TEXT, 'Économie et Société', 'ECONO', 'Introduction aux sciences économiques'),
        (p_school_id::TEXT, 'Littérature Universelle', 'LITT-UNIV', 'Analyse d''œuvres classiques')
    ON CONFLICT (school_id, code) DO NOTHING;

    -- 4. Link subjects to classes
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
    WHERE c.school_id::TEXT = p_school_id::TEXT
      AND s.school_id::TEXT = p_school_id::TEXT
      AND (
        (c.level = 'MATERNELLE' AND s.code IN ('INIT-MATH', 'LANG-COMM', 'PSYCHOMOT', 'ARTS-DESS', 'EVEIL-SCI'))
        OR
        (c.level = 'FONDAMENTALE' AND s.code IN ('MATH-FOND', 'FRAN-FOND', 'CREO-FOND', 'SCI-EXP', 'SCI-SOC', 'ANGL-GEN', 'INFO-TECH', 'EPS-SPORT'))
        OR
        (c.level = 'SECONDAIRE' AND s.code IN ('MATH-FOND', 'PHY-CHI-NS', 'SVT-NS', 'PHILO', 'ECONO', 'LITT-UNIV', 'ANGL-GEN', 'ESPA-GEN', 'INFO-TECH'))
      )
    ON CONFLICT (class_id, subject_id) DO NOTHING;

    -- 5. Create standard supply catalog items
    INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category)
    VALUES 
        (p_school_id::TEXT, v_academic_year_id, 'Uniforme Complet (Maternelle)', 3500, 'Uniforme'),
        (p_school_id::TEXT, v_academic_year_id, 'Uniforme Complet (Fondamentale)', 4500, 'Uniforme'),
        (p_school_id::TEXT, v_academic_year_id, 'Uniforme Complet (Secondaire)', 5500, 'Uniforme'),
        (p_school_id::TEXT, v_academic_year_id, 'Tenue de Sport (EPS complet)', 2500, 'Uniforme'),
        (p_school_id::TEXT, v_academic_year_id, 'Pack Livres : Cycle Maternelle', 8500, 'Manuel'),
        (p_school_id::TEXT, v_academic_year_id, 'Pack Livres : 1e - 6e AF', 13500, 'Manuel'),
        (p_school_id::TEXT, v_academic_year_id, 'Pack Livres : 7e - 9e AF', 16000, 'Manuel'),
        (p_school_id::TEXT, v_academic_year_id, 'Pack Livres : Secondaire (NS1-NS4)', 22500, 'Manuel'),
        (p_school_id::TEXT, v_academic_year_id, 'Assurance Scolaire Annuelle', 1250, 'Service'),
        (p_school_id::TEXT, v_academic_year_id, 'Badge d''Identification Magnétique', 1000, 'Service'),
        (p_school_id::TEXT, v_academic_year_id, 'Accès Laboratoire Informatique (Frais)', 2500, 'Service'),
        (p_school_id::TEXT, v_academic_year_id, 'Carnet de Liaison & Règlement Intérieur', 750, 'Fourniture')
    ON CONFLICT (school_id, academic_year_id, label) DO NOTHING;

END;
$$;
