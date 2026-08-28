-- ===============================================================
-- DEFINITIVE FIX FOR SEEDING AND RLS RECURSION
-- ===============================================================

-- 1. Redefine get_my_school_id() to be fast and safe
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_id TEXT;
    v_profile_school_id UUID;
BEGIN
    -- Try JWT metadata first (fastest, no recursion)
    v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
    IF v_id IS NOT NULL AND v_id != '' THEN
        RETURN v_id::UUID;
    END IF;

    -- Fallback to JWT app_metadata
    v_id := auth.jwt() -> 'app_metadata' ->> 'school_id';
    IF v_id IS NOT NULL AND v_id != '' THEN
        RETURN v_id::UUID;
    END IF;

    -- Deep fallback to profiles table (cached in session usually)
    -- Since this is SECURITY DEFINER, it bypasses RLS on profiles
    SELECT school_id INTO v_profile_school_id
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN v_profile_school_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END; $$;

-- 2. Redefine is_super_admin() to be safe
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role TEXT;
    v_email TEXT;
BEGIN
    -- Check email fallback
    v_email := auth.jwt() ->> 'email';
    -- Using the user email from runtime context as default super admin
    IF v_email = 'jackito46@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- Check JWT metadata
    v_role := auth.jwt() -> 'user_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN
        RETURN TRUE;
    END IF;

    -- Check JWT app_metadata
    v_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN
        RETURN TRUE;
    END IF;

    -- Fallback to profiles table
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'SUPER_ADMIN')
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END; $$;

-- 3. Enhanced seed_school_data
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_ay_id UUID;
BEGIN
    -- Create default academic year
    INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
    VALUES (p_school_id, '2026-2027', true, 'ACTIVE', '2026-09-01', '2027-06-30')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_ay_id;

    IF v_ay_id IS NULL THEN
        SELECT id INTO v_ay_id FROM public.academic_years 
        WHERE school_id = p_school_id AND is_active = true LIMIT 1;
    END IF;

    -- Update school specific global_settings (the JSONB column)
    UPDATE public.schools
    SET global_settings = jsonb_build_object(
        'currency', 'HTG',
        'school_name', name,
        'academic_year_id', v_ay_id
    )
    WHERE id = p_school_id;

    -- Insert standard classes
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

    -- Insert standard subjects (category column exists now)
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

END; $$;
