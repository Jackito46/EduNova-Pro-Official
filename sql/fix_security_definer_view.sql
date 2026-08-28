-- ==============================================================================
-- FIX SUPABASE SECURITY ADVISOR: Security Definer View
-- View: public.v_schools_with_counts
-- ==============================================================================

-- Option 1: Activer security_invoker sur la vue existante
ALTER VIEW public.v_schools_with_counts SET (security_invoker = true);

-- Option 2 (complète): Recréation propre de la vue avec security_invoker = true
DROP VIEW IF EXISTS public.v_schools_with_counts CASCADE;

CREATE OR REPLACE VIEW public.v_schools_with_counts 
WITH (security_invoker = true) AS
SELECT 
  s.id,
  s.name,
  s.address,
  s.phone,
  s.email,
  s.logo_url,
  s.status,
  s.created_at,
  s.subscription_plan,
  s.subscription_end_date,
  s.is_protected,
  s.director_name,
  s.school_type,
  s.website,
  s.domain,
  (SELECT count(1) FROM public.students st WHERE st.school_id = s.id) AS student_count,
  (SELECT count(1) FROM public.profiles p WHERE p.school_id = s.id) AS staff_count
FROM public.schools s;

-- Attribution des permissions
GRANT SELECT ON public.v_schools_with_counts TO authenticated;
GRANT SELECT ON public.v_schools_with_counts TO anon;

-- Rechargement du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
