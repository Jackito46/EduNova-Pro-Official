-- ==============================================================================
-- EduNova Pro - Script de Durcissement de Sécurité PostgreSQL / Supabase
-- ==============================================================================
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase
-- ou via psql sur votre serveur Coolify / VPS.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RÉVOCATION DES FONCTIONS DANGEREUSES EXÉCUTABLES PAR 'anon'
-- ------------------------------------------------------------------------------
-- Par défaut, des fonctions RPC SECURITY DEFINER accordées à 'anon' permettent
-- à n'importe quel visiteur avec la clé publique VITE_SUPABASE_ANON_KEY d'exécuter
-- du code SQL arbitraire. Nous les révoquons immédiatement pour le public :

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'exec_sql') THEN
    REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM public;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'exec_ddl') THEN
    REVOKE EXECUTE ON FUNCTION public.exec_ddl(text) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.exec_ddl(text) FROM public;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. VERROUILLAGE ANTI-ÉLÉVATION DE PRIVILÈGES SUR LA TABLE PROFILES
-- ------------------------------------------------------------------------------
-- Empêche formellement un élève, parent, enseignant ou pirate de modifier
-- son propre rôle vers 'SUPER_ADMIN' ou d'activer le flag 'is_super_admin'.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
  v_caller_is_super boolean;
BEGIN
  -- Si l'utilisateur tente de modifier role ou is_super_admin
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin) THEN
    -- Si la modification vient du backend service_role, autoriser
    IF current_user = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Vérifier si l'appelant actuel est un Super Admin authentifié
    SELECT role, COALESCE(is_super_admin, false)
    INTO v_caller_role, v_caller_is_super
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role NOT IN ('SUPER_ADMIN', 'super_admin') AND NOT v_caller_is_super THEN
      RAISE EXCEPTION 'Action de sécurité refusée : Seul un Super Administrateur peut modifier les rôles ou les privilèges.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_escalation();


-- ------------------------------------------------------------------------------
-- 3. ACTIVATION DU ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES SENSIBLES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 4. PROTECTION DU COFFRE-FORT D'IDENTIFIANTS API (api_credentials)
-- ------------------------------------------------------------------------------
-- Seuls les Super Admins ou les Admins de l'école concernée peuvent lire/écrire
DROP POLICY IF EXISTS "api_credentials_admin_isolation" ON public.api_credentials;
CREATE POLICY "api_credentials_admin_isolation" ON public.api_credentials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role IN ('SUPER_ADMIN', 'super_admin') OR p.is_super_admin = true
      OR (p.school_id = api_credentials.school_id AND p.role IN ('SCHOOL_ADMIN', 'ADMIN', 'DIRECTION'))
    )
  )
);


-- ------------------------------------------------------------------------------
-- 5. PROTECTION DE LA TABLE DES PASSERELLES DE PAIEMENT (payment_gateways)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "payment_gateways_admin_isolation" ON public.payment_gateways;
CREATE POLICY "payment_gateways_admin_isolation" ON public.payment_gateways
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role IN ('SUPER_ADMIN', 'super_admin') OR p.is_super_admin = true
      OR (p.school_id = payment_gateways.school_id AND p.role IN ('SCHOOL_ADMIN', 'ADMIN', 'DIRECTION'))
    )
  )
);

COMMIT;

-- ------------------------------------------------------------------------------
-- 6. AUDIT DE CONFORMITÉ : TABLES SANS RLS (À VÉRIFIER MANUELLEMENT)
-- ------------------------------------------------------------------------------
-- Exécutez cette requête pour vérifier qu'aucune table publique n'a oublié le RLS :
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
