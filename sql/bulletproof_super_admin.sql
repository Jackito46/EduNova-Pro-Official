-- Script pour rendre la fonction is_super_admin 100% fiable

BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_meta_val text;
  v_app_val text;
  v_db_val boolean;
BEGIN
  -- 1. Vérifier le JWT (rapide et sans requête)
  v_meta_val := auth.jwt() -> 'user_metadata' ->> 'is_super_admin';
  v_app_val := auth.jwt() -> 'app_metadata' ->> 'is_super_admin';
  
  IF v_meta_val IN ('true', '1', '"true"') OR v_app_val IN ('true', '1', '"true"') THEN 
    RETURN true; 
  END IF;

  -- 2. Fallback: Vérifier directement dans la table profiles
  -- Comme la fonction est SECURITY DEFINER, elle contourne RLS et évite la récursion
  SELECT is_super_admin INTO v_db_val FROM public.profiles WHERE id = auth.uid();
  
  IF v_db_val = true THEN
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN 
  RETURN false;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
