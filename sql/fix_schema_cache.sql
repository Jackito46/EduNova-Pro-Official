-- SCRIPT POUR CORRIGER L'ERREUR "Database error querying schema"
-- Cette erreur survient quand le cache de schéma de Supabase (PostgREST) est corrompu ou désynchronisé.
-- Ce script va forcer le nettoyage et le rechargement du schéma.

-- 1. Supprimer la vue qui pourrait bloquer le cache
DROP VIEW IF EXISTS public.v_active_fee_plans CASCADE;

-- 2. Recréer la vue proprement avec les bons types
CREATE OR REPLACE VIEW public.v_active_fee_plans AS
SELECT 
    fp.*,
    ay.label as year_label,
    c.name as class_name,
    c.level as class_level
FROM public.fee_plans fp
JOIN public.academic_years ay ON fp.academic_year_id = ay.id
JOIN public.classes c ON fp.class_id = c.id
WHERE ay.is_active = true;

-- 3. S'assurer que les fonctions critiques sont bien définies avec les bons types
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = TRUE
  );
END; $$;

-- 4. Forcer le rechargement du cache de schéma pour l'API
NOTIFY pgrst, 'reload schema';
