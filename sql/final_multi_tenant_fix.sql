-- ==========================================================
-- SCRIPT DE CONSOLIDATION MULTI-TENANT (UUID & RLS)
-- EduNova Pro - Version Finale de Sécurisation
-- ==========================================================

DO $$ 
DECLARE
    v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
    r RECORD;
BEGIN
    -- 1. S'ASSURER QUE get_my_school_id() EST CORRECT ET RETOURNE UN UUID
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.get_my_school_id()
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN (
        SELECT school_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      );
    END;
    $func$;
    ';

    -- 2. CONVERSION DE TOUTES LES COLONNES school_id EN UUID
    -- On boucle sur toutes les tables du schéma public qui ont une colonne school_id
    FOR r IN 
        SELECT table_name, column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'school_id'
          AND table_name != 'schools'
    LOOP
        -- Si la colonne est de type texte, on la convertit
        IF r.data_type IN ('text', 'character varying', 'varchar') THEN
            -- Nettoyage des valeurs non-UUID (on les remplace par l'école principale par défaut)
            EXECUTE format('
                UPDATE public.%I 
                SET %I = %L 
                WHERE %I !~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''
                   OR %I IS NULL
            ', r.table_name, r.column_name, v_main_school_id::text, r.column_name, r.column_name);

            -- Changement de type
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE UUID USING %I::UUID', 
                r.table_name, r.column_name, r.column_name);
            
            -- Suppression de l''ancienne valeur par défaut si elle existe
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', 
                r.table_name, r.column_name);
        END IF;
    END LOOP;

    -- 3. RÉPARATION DE LA TABLE staff_attendances (Elle était mal définie)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_attendances') THEN
        -- On vérifie si elle pointe vers ''users'' (qui n''existe pas dans public)
        -- On la recrée proprement si nécessaire
        DROP TABLE IF EXISTS public.staff_attendances CASCADE;
    END IF;

    CREATE TABLE public.staff_attendances (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
        staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
        assignment_id UUID REFERENCES public.staff_assignments(id) ON DELETE SET NULL,
        date DATE NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('Présent', 'Absent', 'Retard')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        UNIQUE(staff_id, assignment_id, date)
    );

    -- 4. AJOUT DE school_id À staff_assignments POUR LA PERFORMANCE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_assignments' AND column_name = 'school_id') THEN
        ALTER TABLE public.staff_assignments ADD COLUMN school_id UUID;
        
        -- On remplit school_id à partir de la table staff
        UPDATE public.staff_assignments sa
        SET school_id = s.school_id
        FROM public.staff s
        WHERE sa.staff_id = s.id;
        
        -- On rend la colonne NOT NULL après remplissage
        ALTER TABLE public.staff_assignments ALTER COLUMN school_id SET NOT NULL;
        ALTER TABLE public.staff_assignments ADD CONSTRAINT staff_assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 5. UNIFICATION DES POLITIQUES RLS (Utilisation systématique de get_my_school_id)

-- Fonction utilitaire pour recréer les politiques multi-tenant standards
CREATE OR REPLACE FUNCTION public.apply_standard_rls(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    EXECUTE format('CREATE POLICY "Isolation %I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id())', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- Application aux tables principales
SELECT public.apply_standard_rls('academic_years');
SELECT public.apply_standard_rls('classes');
SELECT public.apply_standard_rls('subjects');
SELECT public.apply_standard_rls('students');
SELECT public.apply_standard_rls('fee_plans');
SELECT public.apply_standard_rls('expense_categories');
SELECT public.apply_standard_rls('expenses');
SELECT public.apply_standard_rls('payments');
SELECT public.apply_standard_rls('staff');
SELECT public.apply_standard_rls('enrollments');
SELECT public.apply_standard_rls('staff_assignments');
SELECT public.apply_standard_rls('staff_attendances');
SELECT public.apply_standard_rls('school_details');
SELECT public.apply_standard_rls('payroll_periods');

-- Cas particulier pour payroll_slips (jointure nécessaire car pas de school_id direct)
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolation payroll_slips" ON public.payroll_slips;
CREATE POLICY "Isolation payroll_slips" ON public.payroll_slips FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.payroll_periods 
        WHERE public.payroll_periods.id = public.payroll_slips.period_id 
        AND public.payroll_periods.school_id = public.get_my_school_id()
    )
);

-- Cas particulier pour audit_logs (lecture restreinte aux admins)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit logs isolation" ON public.audit_logs;
CREATE POLICY "Audit logs isolation" ON public.audit_logs FOR SELECT USING (
    school_id = public.get_my_school_id() AND public.is_admin()
);
DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;
CREATE POLICY "Audit logs insert" ON public.audit_logs FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
);

-- Nettoyage
DROP FUNCTION IF EXISTS public.apply_standard_rls(TEXT);

NOTIFY pgrst, 'reload schema';
