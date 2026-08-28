-- FINAL REPAIR FOR SEEDING SCRIPT
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_ay_id UUID;
BEGIN
    -- 1. Default Academic Year
    INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
    VALUES (p_school_id, '2026-2027', true, 'ACTIVE', '2026-09-01', '2027-06-30')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_ay_id;

    IF v_ay_id IS NULL THEN
        SELECT id INTO v_ay_id FROM public.academic_years 
        WHERE school_id = p_school_id AND is_active = true LIMIT 1;
    END IF;

    -- 2. School Settings (JSONB column)
    UPDATE public.schools
    SET global_settings = jsonb_build_object(
        'currency', 'HTG',
        'school_name', name,
        'academic_year_id', v_ay_id
    )
    WHERE id = p_school_id;

    -- 3. Classes (ON CONFLICT using name)
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

    -- 4. Subjects (ON CONFLICT using code)
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
    ON CONFLICT (school_id, code) DO NOTHING;

END; $$;
