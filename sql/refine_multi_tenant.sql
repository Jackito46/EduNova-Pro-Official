-- ==========================================================
-- REFINEMENT FOR MULTI-TENANCY: AUDIT LOGS & SUPER ADMIN
-- ==========================================================

-- 1. Permettre à school_id d'être NULL dans audit_logs pour les actions globales
ALTER TABLE public.audit_logs ALTER COLUMN school_id DROP NOT NULL;

-- 2. Mise à jour des politiques RLS pour audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs for their school" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs isolation" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs select" ON public.audit_logs;

-- Politique de lecture : Super Admin voit tout s'il n'a pas choisi d'école, sinon il voit l'école choisie
CREATE POLICY "Audit logs select" ON public.audit_logs
FOR SELECT USING (
    (public.is_super_admin() AND public.get_my_school_id() IS NULL) OR school_id = public.get_my_school_id()
);

-- Politique d'insertion : Tout le monde peut insérer (pour le traçage)
CREATE POLICY "Audit logs insert" ON public.audit_logs
FOR INSERT WITH CHECK (
    (public.is_super_admin() AND public.get_my_school_id() IS NULL) OR school_id = public.get_my_school_id() OR auth.uid() IS NOT NULL
);

-- 3. S'assurer que les Super Admins peuvent voir toutes les écoles (nécessaire pour la console)
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    id = public.get_my_school_id() OR public.is_super_admin()
);

-- Permettre aux admins d'école de modifier uniquement leur propre école
DROP POLICY IF EXISTS "Schools update" ON public.schools;
CREATE POLICY "Schools update" ON public.schools
FOR UPDATE USING (
    id = public.get_my_school_id() OR public.is_super_admin()
);

-- 4. S'assurer que les Super Admins peuvent voir tous les profils (nécessaire pour la gestion globale)
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (public.is_super_admin());

-- Amélioration de get_school_profiles pour supporter l'impersonnalisation
CREATE OR REPLACE FUNCTION public.get_school_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_is_super BOOLEAN;
BEGIN
  SELECT school_id, is_super_admin INTO v_school_id, v_is_super 
  FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  IF v_is_super AND v_school_id IS NULL THEN
    -- Super Admin en mode global voit tout
    RETURN QUERY SELECT * FROM public.profiles;
  ELSE
    -- Sinon on filtre par l'école actuelle (impersonnalisée ou réelle)
    RETURN QUERY SELECT * FROM public.profiles WHERE school_id = v_school_id;
  END IF;
END;
$$;

-- 5. Paramètres globaux : Seul le Super Admin peut voir et modifier
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global settings superadmin" ON public.global_settings;
CREATE POLICY "Global settings superadmin" ON public.global_settings
FOR ALL USING (public.is_super_admin());

-- 6. Fonction utilitaire pour recréer les politiques multi-tenant avec support Super Admin
CREATE OR REPLACE FUNCTION public.apply_super_rls(p_table_name TEXT)
RETURNS VOID AS $func$
BEGIN
    -- Vérifier si la table existe avant de continuer
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN;
    END IF;

    -- Vérifier si la colonne school_id existe avant de continuer
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'school_id'
    ) THEN
        RETURN;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    
    -- On supprime l'ancienne politique d'isolation si elle existe
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    
    -- On crée la nouvelle politique qui inclut le Super Admin avec support d'impersonation
    EXECUTE format('CREATE POLICY "Isolation %I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR (public.is_super_admin() AND public.get_my_school_id() IS NULL))', p_table_name, p_table_name);
END;
$func$ LANGUAGE plpgsql;

-- Application aux tables principales
SELECT public.apply_super_rls('profiles');
SELECT public.apply_super_rls('academic_years');
SELECT public.apply_super_rls('classes');
SELECT public.apply_super_rls('subjects');
SELECT public.apply_super_rls('students');
SELECT public.apply_super_rls('fee_plans');
SELECT public.apply_super_rls('expense_categories');
SELECT public.apply_super_rls('expenses');
SELECT public.apply_super_rls('payments');
SELECT public.apply_super_rls('staff');
SELECT public.apply_super_rls('enrollments');
SELECT public.apply_super_rls('staff_assignments');
SELECT public.apply_super_rls('staff_attendances');
SELECT public.apply_super_rls('payroll_periods');
SELECT public.apply_super_rls('school_supplies');
SELECT public.apply_super_rls('supply_catalog');
SELECT public.apply_super_rls('audit_logs');
SELECT public.apply_super_rls('payroll_slips');
SELECT public.apply_super_rls('grades');
SELECT public.apply_super_rls('student_attendances');
SELECT public.apply_super_rls('salary_advances');

-- Nettoyage de la fonction temporaire
DROP FUNCTION IF EXISTS public.apply_super_rls(TEXT);

NOTIFY pgrst, 'reload schema';
