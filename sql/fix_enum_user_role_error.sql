-- ==============================================================================
-- EDUNOVA PRO - CORRECTIF IMMÉDIAT ERREUR 22P02 (user_role enum)
-- Résout : invalid input value for enum user_role: ""
-- ==============================================================================

-- 1. Fonction is_super_admin sécurisée avec cast explicite role::text
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_is_super BOOLEAN;
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT COALESCE(is_super_admin, false), role::text INTO v_is_super, v_role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_is_super = true THEN
        RETURN true;
    END IF;

    IF v_role IS NOT NULL AND UPPER(v_role) IN ('SUPER_ADMIN') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 2. Fonction is_admin sécurisée avec cast explicite role::text
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_role TEXT;
    v_is_super BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT role::text, COALESCE(is_super_admin, false) INTO v_role, v_is_super
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_is_super = true OR (v_role IS NOT NULL AND UPPER(v_role) = 'SUPER_ADMIN') THEN
        RETURN true;
    END IF;

    RETURN v_role IS NOT NULL AND UPPER(v_role) IN ('SCHOOL_ADMIN', 'ADMIN', 'DIRECTION', 'PRINCIPAL', 'DIRECTEUR');
END;
$$;

-- 3. Fonction get_my_school_id sécurisée
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_school_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT school_id INTO v_school_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    RETURN v_school_id;
END;
$$;

-- 4. Attribution des droits d'exécution
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated, anon, service_role;

-- 5. Notification à PostgREST pour recharger le schéma immédiatement
NOTIFY pgrst, 'reload schema';
