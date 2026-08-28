
-- ==========================================================
-- OPTIMISATION & GESTION UTILISATEURS - EduNova Pro
-- ==========================================================

-- 1. INDEXATION POUR LA VITESSE (Lecture Instantanée)
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_school_id ON public.staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);

-- 2. EXTENSION POUR INVITER DES UTILISATEURS (Fonction RPC)
-- Permet à l'admin de créer des profils qui seront liés à l'auth plus tard
DROP FUNCTION IF EXISTS public.create_user_profile(TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.create_user_profile(
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_school_id UUID
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, school_id)
    VALUES (extensions.uuid_generate_v4(), p_email, p_full_name, p_role, p_school_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. AJOUT DE LA COLONNE PHOTO DANS STAFF (Si manquante)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
