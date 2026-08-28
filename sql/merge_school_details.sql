-- ==========================================================
-- SCRIPT DE MIGRATION : FUSION DE SCHOOL_DETAILS VERS SCHOOLS
-- ==========================================================

-- 1. Ajout des colonnes manquantes à la table schools
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS director_name TEXT,
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS stamp_url TEXT,
ADD COLUMN IF NOT EXISTS motto TEXT;

-- 2. Migration des données de school_details vers schools
-- On met à jour les écoles existantes avec les détails correspondants
UPDATE public.schools s
SET
    address = sd.address,
    phone = sd.phone,
    email = sd.email,
    director_name = sd.director_name,
    license_number = sd.license_number,
    logo_url = sd.logo_url,
    stamp_url = sd.stamp_url
FROM public.school_details sd
WHERE s.id = sd.school_id;

-- 3. Mise à jour des politiques de sécurité (RLS) sur schools
-- S'assurer que les administrateurs de l'école peuvent mettre à jour leur profil
DROP POLICY IF EXISTS "Schools update" ON public.schools;
CREATE POLICY "Schools update" ON public.schools
    FOR UPDATE USING (id = public.get_my_school_id());

-- 4. Suppression de la table school_details et de ses politiques
DROP TABLE IF EXISTS public.school_details CASCADE;

-- 5. Rafraîchissement du cache PostgREST
NOTIFY pgrst, 'reload schema';
