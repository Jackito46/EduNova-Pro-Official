-- ==============================================================================
-- EDUNOVA PRO - SCRIPT GLOBAL DE DURCISSEMENT ROW LEVEL SECURITY (RLS)
-- Version : 4.9 Production Hardening (Resilient Schema-Aware Edition)
-- Objectif : Élimination absolue des failles multi-tenant (USING true / anon)
--            et garantie d'une étanchéité totale entre établissements scolaires.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FONCTIONS UTILITAIRES DE SÉCURITÉ (SECURITY DEFINER & SEARCH_PATH SÉCURISÉ)
-- ------------------------------------------------------------------------------

-- Récupération ultra-rapide et sécurisée du school_id de l'utilisateur authentifié
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

-- Vérification des privilèges Super Administrateur
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

-- Vérification des privilèges d'administration d'établissement (Admin, Direction, Principal)
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

-- Permissions d'exécution
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;


-- ------------------------------------------------------------------------------
-- 2. PROCÉDURE DE NETTOYAGE DES POLITIQUES PERMISSIVES ET APPLICATION STRICTE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.harden_table_rls(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    pol RECORD;
BEGIN
    -- 1. Vérifier si la table existe dans public
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table) THEN
        RETURN;
    END IF;

    -- 2. Activer et FORCER le RLS (même pour les propriétaires non-superuser)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', p_table);

    -- 3. Supprimer toutes les anciennes politiques existantes (nettoyage des politiques permissives)
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = p_table 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
    END LOOP;

    -- 4. Créer la politique d'isolation stricte par school_id si la colonne school_id existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'school_id'
    ) THEN
        EXECUTE format('
            CREATE POLICY "strict_school_isolation_%I" ON public.%I
            FOR ALL
            TO authenticated
            USING (
                public.is_super_admin() 
                OR school_id = public.get_my_school_id()
            )
            WITH CHECK (
                public.is_super_admin() 
                OR school_id = public.get_my_school_id()
            )
        ', p_table, p_table);
    END IF;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. APPLICATION DU DURCISSEMENT MULTI-TENANT AUX TABLES MÉTIER
-- ------------------------------------------------------------------------------

-- Tables académiques et administratives
SELECT public.harden_table_rls('academic_years');
SELECT public.harden_table_rls('classes');
SELECT public.harden_table_rls('subjects');
SELECT public.harden_table_rls('class_subjects');
SELECT public.harden_table_rls('students');
SELECT public.harden_table_rls('enrollments');
SELECT public.harden_table_rls('school_campuses');
SELECT public.harden_table_rls('staff');
SELECT public.harden_table_rls('staff_assignments');
SELECT public.harden_table_rls('staff_roles');
SELECT public.harden_table_rls('staff_attendances');

-- Tables financières
SELECT public.harden_table_rls('fee_plans');
SELECT public.harden_table_rls('fee_installments');
SELECT public.harden_table_rls('tuition_plans');
SELECT public.harden_table_rls('tuition_installments');
SELECT public.harden_table_rls('student_tuition_balances');
SELECT public.harden_table_rls('payments');
SELECT public.harden_table_rls('payment_allocations');
SELECT public.harden_table_rls('payment_gateways');
SELECT public.harden_table_rls('expense_categories');
SELECT public.harden_table_rls('expenses');
SELECT public.harden_table_rls('salary_advances');
SELECT public.harden_table_rls('payroll_periods');

-- Module Devoirs et Cahier de Textes
SELECT public.harden_table_rls('homework_assignments');
SELECT public.harden_table_rls('homework_student_reads');
SELECT public.harden_table_rls('homework_submissions');


-- ------------------------------------------------------------------------------
-- 4. POLITIQUES SPÉCIFIQUES RENFORCÉES (DONNÉES HAUTEMENT CONFIDENTIELLES)
-- ------------------------------------------------------------------------------

-- Table des profils utilisateurs (profiles)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_all_policy" ON public.profiles;
        DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_select_hardened" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_update_hardened" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_insert_hardened" ON public.profiles;

        -- Lecture : Soi-même, son propre établissement, ou Super Administrateur
        CREATE POLICY "profiles_select_hardened" ON public.profiles
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin()
                OR id = auth.uid()
                OR school_id = public.get_my_school_id()
            );

        -- Modification : Soi-même (mise à jour profil), Administrateur de l'école, ou Super Admin
        CREATE POLICY "profiles_update_hardened" ON public.profiles
            FOR UPDATE
            TO authenticated
            USING (
                public.is_super_admin()
                OR id = auth.uid()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            )
            WITH CHECK (
                public.is_super_admin()
                OR id = auth.uid()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            );

        -- Insertion de profil : Utilisateur authentifié à la création de son compte ou Admin
        CREATE POLICY "profiles_insert_hardened" ON public.profiles
            FOR INSERT
            TO authenticated
            WITH CHECK (
                public.is_super_admin()
                OR id = auth.uid()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            );
    END IF;
END $$;

-- Table des Identifiants & Clés API (api_credentials - Coffre-fort chiffré)
-- STRICTEMENT RÉSERVÉ AUX ADMINISTRATEURS DE L'ÉTABLISSEMENT & SUPER ADMIN
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_credentials') THEN
        ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.api_credentials FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "allow_school_members_api_creds" ON public.api_credentials;
        DROP POLICY IF EXISTS "api_credentials_strict" ON public.api_credentials;

        CREATE POLICY "api_credentials_strict" ON public.api_credentials
            FOR ALL
            TO authenticated
            USING (
                public.is_super_admin()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            )
            WITH CHECK (
                public.is_super_admin()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            );
    END IF;
END $$;

-- Table des Paramètres de Communication (communication_settings)
-- STRICTEMENT RÉSERVÉ AUX ADMINISTRATEURS DE L'ÉTABLISSEMENT & SUPER ADMIN
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_settings') THEN
        ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.communication_settings FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can manage communication settings of their school" ON public.communication_settings;
        DROP POLICY IF EXISTS "communication_settings_strict" ON public.communication_settings;

        CREATE POLICY "communication_settings_strict" ON public.communication_settings
            FOR ALL
            TO authenticated
            USING (
                public.is_super_admin()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            )
            WITH CHECK (
                public.is_super_admin()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            );
    END IF;
END $$;

-- Fiches de Paie (payroll_slips - Jointure sur payroll_periods)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_slips') THEN
        ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.payroll_slips FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Isolation payroll_slips" ON public.payroll_slips;
        DROP POLICY IF EXISTS "payroll_slips_strict" ON public.payroll_slips;

        CREATE POLICY "payroll_slips_strict" ON public.payroll_slips
            FOR ALL
            TO authenticated
            USING (
                public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.payroll_periods pp
                    WHERE pp.id = public.payroll_slips.period_id
                      AND pp.school_id = public.get_my_school_id()
                      AND public.is_admin()
                )
            )
            WITH CHECK (
                public.is_super_admin()
                OR EXISTS (
                    SELECT 1 FROM public.payroll_periods pp
                    WHERE pp.id = public.payroll_slips.period_id
                      AND pp.school_id = public.get_my_school_id()
                      AND public.is_admin()
                )
            );
    END IF;
END $$;

-- Table des Journaux d'Audit (audit_logs)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Audit logs isolation" ON public.audit_logs;
        DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;
        DROP POLICY IF EXISTS "audit_logs_select_strict" ON public.audit_logs;
        DROP POLICY IF EXISTS "audit_logs_insert_strict" ON public.audit_logs;

        CREATE POLICY "audit_logs_select_strict" ON public.audit_logs
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin()
                OR (school_id = public.get_my_school_id() AND public.is_admin())
            );

        CREATE POLICY "audit_logs_insert_strict" ON public.audit_logs
            FOR INSERT
            TO authenticated
            WITH CHECK (
                public.is_super_admin()
                OR school_id = public.get_my_school_id()
            );
    END IF;
END $$;

-- Table des Établissements (schools)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools') THEN
        ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.schools FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "schools_read" ON public.schools;
        DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
        DROP POLICY IF EXISTS "schools_select_strict" ON public.schools;
        DROP POLICY IF EXISTS "schools_manage_strict" ON public.schools;

        -- Tout utilisateur connecté peut voir les informations de son établissement (ou Super Admin)
        CREATE POLICY "schools_select_strict" ON public.schools
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin()
                OR id = public.get_my_school_id()
            );

        -- Modification : Administrateur de l'école ou Super Admin
        CREATE POLICY "schools_manage_strict" ON public.schools
            FOR UPDATE
            TO authenticated
            USING (
                public.is_super_admin()
                OR (id = public.get_my_school_id() AND public.is_admin())
            )
            WITH CHECK (
                public.is_super_admin()
                OR (id = public.get_my_school_id() AND public.is_admin())
            );
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 5. NETTOYAGE DES FONCTIONS D'INSTALLATION TEMPORAIRES & NOTIFICATION SCHEMA
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.harden_table_rls(TEXT);

-- Notification à PostgREST pour recharger instantanément les politiques
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIN DU SCRIPT DE DURCISSEMENT GLOBAL RLS
-- ==============================================================================
