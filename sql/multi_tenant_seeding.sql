
-- 1. Function to seed standard data for a new school
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_academic_year_id UUID;
BEGIN
    -- 1. Create an active academic year
    INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
    VALUES (p_school_id, '2025-2026', true, 'ACTIVE', '2025-09-01', '2026-06-30')
    RETURNING id INTO v_academic_year_id;

    -- 2. Create standard classes
    -- MATERNELLE
    INSERT INTO public.classes (school_id, name, level) VALUES 
    (p_school_id, 'Petite Section', 'MATERNELLE'),
    (p_school_id, 'Moyenne Section', 'MATERNELLE'),
    (p_school_id, 'Grande Section', 'MATERNELLE');

    -- FONDAMENTALE
    INSERT INTO public.classes (school_id, name, level) VALUES 
    (p_school_id, '1ère AF', 'FONDAMENTALE'),
    (p_school_id, '2ème AF', 'FONDAMENTALE'),
    (p_school_id, '3ème AF', 'FONDAMENTALE'),
    (p_school_id, '4ème AF', 'FONDAMENTALE'),
    (p_school_id, '5ème AF', 'FONDAMENTALE'),
    (p_school_id, '6ème AF', 'FONDAMENTALE'),
    (p_school_id, '7ème AF', 'FONDAMENTALE'),
    (p_school_id, '8ème AF', 'FONDAMENTALE'),
    (p_school_id, '9ème AF', 'FONDAMENTALE');

    -- SECONDAIRE
    INSERT INTO public.classes (school_id, name, level) VALUES 
    (p_school_id, 'NS I', 'SECONDAIRE'),
    (p_school_id, 'NS II', 'SECONDAIRE'),
    (p_school_id, 'NS III', 'SECONDAIRE'),
    (p_school_id, 'NS IV', 'SECONDAIRE');

    -- 3. Create standard subjects
    INSERT INTO public.subjects (school_id, name, code, description) VALUES 
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
    (p_school_id, 'Littérature Universelle', 'LITT-UNIV', 'Analyse d''œuvres classiques');

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
    WHERE c.school_id = p_school_id 
      AND s.school_id = p_school_id
      AND (
        (c.level = 'MATERNELLE' AND s.code IN ('INIT-MATH', 'LANG-COMM', 'PSYCHOMOT', 'ARTS-DESS', 'EVEIL-SCI'))
        OR
        (c.level = 'FONDAMENTALE' AND s.code IN ('MATH-FOND', 'FRAN-FOND', 'CREO-FOND', 'SCI-EXP', 'SCI-SOC', 'ANGL-GEN', 'INFO-TECH', 'EPS-SPORT'))
        OR
        (c.level = 'SECONDAIRE' AND s.code IN ('MATH-FOND', 'PHY-CHI-NS', 'SVT-NS', 'PHILO', 'ECONO', 'LITT-UNIV', 'ANGL-GEN', 'ESPA-GEN', 'INFO-TECH'))
      );

    -- 5. Create standard supply catalog items
    INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category) VALUES 
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
    (p_school_id, v_academic_year_id, 'Blouse de Laboratoire Logotée', 2000, 'Fourniture');

END;
$$;

-- 2. Update admin_create_tenant to call seed_school_data
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
    p_school_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_admin_name TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_school_id UUID;
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Seul un Super Admin peut créer un établissement.');
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cet email est déjà utilisé par un autre utilisateur.');
    END IF;

    v_school_id := gen_random_uuid();

    INSERT INTO public.schools (id, name, status, subscription_plan)
    VALUES (v_school_id, p_school_name, 'ACTIVE', 'trial');

    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(p_admin_password, extensions.gen_salt('bf'));
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_admin_email, v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_admin_name, 'school_id', v_school_id),
        now(), now()
    );

    -- Create identity for the user to allow login
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', p_admin_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
    VALUES (v_user_id, p_admin_email, p_admin_name, 'SCHOOL_ADMIN', v_school_id, FALSE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        school_id = EXCLUDED.school_id,
        is_super_admin = EXCLUDED.is_super_admin;

    -- SEED STANDARD DATA
    PERFORM public.seed_school_data(v_school_id);

    RETURN jsonb_build_object(
        'success', true, 
        'school_id', v_school_id, 
        'admin_id', v_user_id,
        'message', 'Établissement et administrateur créés avec succès avec les données standards injectées.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
