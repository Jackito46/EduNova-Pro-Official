-- Script de réparation ultra-sécurisé pour les fonctions RLS

BEGIN;

-- 1. Fonction is_super_admin ultra-sécurisée (ne plante jamais)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_meta_val text;
  v_app_val text;
BEGIN
  -- Récupérer les valeurs sous forme de texte
  v_meta_val := auth.jwt() -> 'user_metadata' ->> 'is_super_admin';
  v_app_val := auth.jwt() -> 'app_metadata' ->> 'is_super_admin';
  
  -- Vérifier si c'est explicitement 'true'
  IF v_meta_val = 'true' OR v_app_val = 'true' THEN
    RETURN true;
  END IF;
  
  RETURN false;
EXCEPTION WHEN OTHERS THEN 
  RETURN false;
END;
$$;

-- 2. Fonction get_my_school_id ultra-sécurisée (ne plante jamais)
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE 
  v_id text;
BEGIN
  v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
  
  -- Vérifier si c'est un UUID valide (format basique)
  IF v_id IS NULL OR v_id = '' OR length(v_id) != 36 THEN 
    RETURN NULL; 
  END IF;
  
  RETURN v_id::uuid;
EXCEPTION WHEN OTHERS THEN 
  RETURN NULL;
END;
$$;

-- 3. S'assurer que les politiques sur profiles sont propres
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.is_super_admin() OR school_id = public.get_my_school_id()
);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL USING (
  id = auth.uid() OR public.is_super_admin()
);

COMMIT;

NOTIFY pgrst, 'reload schema';
