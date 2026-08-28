-- Enhanced seed_school_data to provide a better set of initial data
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $f$
DECLARE
    v_ay_id UUID;
BEGIN
    -- 1. Create default academic year if none active
    SELECT id INTO v_ay_id FROM public.academic_years 
    WHERE school_id::TEXT = p_school_id::TEXT AND is_active = true LIMIT 1;

    IF v_ay_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
        VALUES (p_school_id, '2026-2027', true, 'ACTIVE', '2026-09-01', '2027-06-30')
        RETURNING id INTO v_ay_id;
    END IF;

    -- 2. Insert standard classes
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
        (p_school_id, 'NS1', 'SECONDAIRE'),
        (p_school_id, 'NS2', 'SECONDAIRE'),
        (p_school_id, 'NS3', 'SECONDAIRE'),
        (p_school_id, 'NS4', 'SECONDAIRE')
    ON CONFLICT (school_id, name) DO NOTHING;

    -- 3. Insert standard subjects
    INSERT INTO public.subjects (school_id, name, code, category)
    VALUES 
        (p_school_id, 'Français', 'FRA', 'LANGUAGES'),
        (p_school_id, 'Mathématiques', 'MAT', 'SCIENCE'),
        (p_school_id, 'Créole', 'CRE', 'LANGUAGES'),
        (p_school_id, 'Anglais', 'ANG', 'LANGUAGES'),
        (p_school_id, 'Sciences Sociales', 'SS', 'GENERAL'),
        (p_school_id, 'Sciences Physiques', 'SP', 'SCIENCE'),
        (p_school_id, 'Biologie', 'BIO', 'SCIENCE'),
        (p_school_id, 'Chimie', 'CHI', 'SCIENCE'),
        (p_school_id, 'Informatique', 'INF', 'TECH')
    ON CONFLICT (school_id, name) DO NOTHING;
    
    -- 4. Insert Global Settings if missing
    INSERT INTO public.global_settings (school_id, academic_year_id, currency, school_name)
    SELECT p_school_id, v_ay_id, 'HTG', s.name
    FROM public.schools s
    WHERE s.id = p_school_id
    ON CONFLICT (school_id) DO NOTHING;

END; $f$;
