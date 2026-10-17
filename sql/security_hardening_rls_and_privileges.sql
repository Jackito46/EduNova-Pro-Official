-- ==============================================================================
-- EduNova Pro - Script de Durcissement de Sécurité PostgreSQL / Supabase (V3)
-- ==============================================================================
-- 100% Compatible Enums : Utilise role::text pour éviter l'erreur 22P02.
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RÉVOCATION DES FONCTIONS DANGEREUSES EXÉCUTABLES PAR 'anon'
-- ------------------------------------------------------------------------------
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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $trg$
      DECLARE
        v_caller_role text;
        v_caller_is_super boolean;
      BEGIN
        IF (NEW.role::text IS DISTINCT FROM OLD.role::text) OR (NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin) THEN
          IF current_user = 'service_role' THEN
            RETURN NEW;
          END IF;

          SELECT UPPER(COALESCE(role::text, '')), COALESCE(is_super_admin, false)
          INTO v_caller_role, v_caller_is_super
          FROM public.profiles
          WHERE id = auth.uid();

          IF v_caller_role != 'SUPER_ADMIN' AND NOT v_caller_is_super THEN
            RAISE EXCEPTION 'Action de sécurité refusée : Seul un Super Administrateur peut modifier les rôles ou les privilèges.';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $trg$;
    $func$;

    DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
    CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. CRÉATION CONDITIONNELLE DES TABLES DU COFFRE-FORT SI ABSENTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    key_name TEXT NOT NULL,
    key_value TEXT,
    encrypted_value TEXT,
    is_secret BOOLEAN DEFAULT false,
    environment TEXT DEFAULT 'production',
    is_active BOOLEAN DEFAULT true,
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'UNTESTED',
    validation_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_api_credentials UNIQUE (school_id, service_name, key_name, environment)
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL,
    client_id TEXT,
    client_secret TEXT,
    business_key TEXT,
    receiver_phone TEXT,
    receiver_name TEXT,
    receiver_operator TEXT,
    webhook_secret TEXT,
    mode TEXT DEFAULT 'production',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- ------------------------------------------------------------------------------
-- 4. ACTIVATION CONDITIONNELLE DU ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables_to_protect text[] := ARRAY[
    'profiles', 'schools', 'school_campuses', 'students', 'payments', 
    'payment_gateways', 'api_credentials', 'academic_years', 'classes', 
    'subjects', 'grades', 'attendances', 'communication_settings', 'push_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_protect LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 5. PROTECTION DE LA TABLE DU COFFRE-FORT API (api_credentials)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_credentials') THEN
    EXECUTE 'DROP POLICY IF EXISTS "api_credentials_admin_isolation" ON public.api_credentials;';
    EXECUTE 'CREATE POLICY "api_credentials_admin_isolation" ON public.api_credentials
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND (
            UPPER(p.role::text) = ''SUPER_ADMIN'' OR p.is_super_admin = true
            OR (p.school_id = api_credentials.school_id AND UPPER(p.role::text) IN (''SCHOOL_ADMIN'', ''ADMIN'', ''DIRECTION'', ''DIRECTOR''))
          )
        )
      );';
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 6. PROTECTION DE LA TABLE DES PASSERELLES DE PAIEMENT (payment_gateways)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_gateways') THEN
    EXECUTE 'DROP POLICY IF EXISTS "payment_gateways_admin_isolation" ON public.payment_gateways;';
    EXECUTE 'CREATE POLICY "payment_gateways_admin_isolation" ON public.payment_gateways
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND (
            UPPER(p.role::text) = ''SUPER_ADMIN'' OR p.is_super_admin = true
            OR (p.school_id = payment_gateways.school_id AND UPPER(p.role::text) IN (''SCHOOL_ADMIN'', ''ADMIN'', ''DIRECTION'', ''DIRECTOR''))
          )
        )
      );';
  END IF;
END $$;

COMMIT;
