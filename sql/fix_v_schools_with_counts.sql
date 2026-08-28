-- Script pour créer la vue manquante v_schools_with_counts

BEGIN;

-- 1. Création de la vue avec security_invoker activé (Supabase Security Best Practice)
CREATE OR REPLACE VIEW public.v_schools_with_counts 
WITH (security_invoker = true) AS
SELECT 
  s.*,
  (SELECT count(*) FROM public.profiles p WHERE p.school_id = s.id) as profiles_count
FROM public.schools s;

-- 2. Accorder les droits de lecture sur cette vue
GRANT SELECT ON public.v_schools_with_counts TO authenticated;
GRANT SELECT ON public.v_schools_with_counts TO anon;

COMMIT;

-- 3. Forcer le rechargement du cache du schéma PostgREST
-- C'est cette ligne qui résout l'erreur "Could not find the table in the schema cache"
NOTIFY pgrst, 'reload schema';
