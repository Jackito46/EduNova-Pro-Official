-- ==========================================================
-- SCRIPT DE SÉCURITÉ ROW LEVEL SECURITY (RLS) & RBAC POUR LA PAIE
-- ==========================================================
-- Ce script implémente le contrôle d'accès basé sur les rôles (RBAC)
-- au niveau de la base de données pour le module Payroll :
-- 1. Les super-utilisateurs (is_super_admin) et les administrateurs centraux
--    (sans annexe assignée) peuvent accéder et gérer toutes les données de paie de leur école.
-- 2. Les administrateurs d'une annexe spécifique ne peuvent accéder
--    QU'AUX données de paie (périodes, fiches, avances) de leur propre annexe.
-- 3. Isolation multi-tenant stricte garantie par school_id.

-- 0. Fonction utilitaire d'extraction de l'annexe de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_my_campus_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jwt_campus TEXT;
  v_profile_campus UUID;
BEGIN
  -- Vérification des métadonnées JWT
  v_jwt_campus := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'campus_id',
    auth.jwt() -> 'app_metadata' ->> 'campus_id',
    auth.jwt() ->> 'campus_id'
  );
  
  IF v_jwt_campus IS NOT NULL AND v_jwt_campus <> '' THEN
    BEGIN
      RETURN v_jwt_campus::UUID;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Repli sécurisé sur la table des profils
  SELECT campus_id INTO v_profile_campus 
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;

  RETURN v_profile_campus;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_my_campus_id() TO authenticated, anon;


-- ==========================================================
-- 1. SÉCURISATION DE LA TABLE payroll_periods
-- ==========================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users on payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Payroll periods view policy" ON public.payroll_periods;
CREATE POLICY "Payroll periods view policy" 
ON public.payroll_periods FOR SELECT 
USING (
  school_id = public.get_my_school_id() AND (
    public.is_super_admin() OR 
    public.get_my_campus_id() IS NULL OR 
    campus_id = public.get_my_campus_id() OR
    campus_id IS NULL
  )
);

DROP POLICY IF EXISTS "Enable insert for admins on payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Payroll periods insert policy" ON public.payroll_periods;
CREATE POLICY "Payroll periods insert policy" 
ON public.payroll_periods FOR INSERT 
WITH CHECK (
  public.is_admin() AND 
  school_id = public.get_my_school_id() AND (
    public.is_super_admin() OR 
    public.get_my_campus_id() IS NULL OR 
    campus_id = public.get_my_campus_id()
  )
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Payroll periods update policy" ON public.payroll_periods;
CREATE POLICY "Payroll periods update policy" 
ON public.payroll_periods FOR UPDATE 
USING (
  public.is_admin() AND 
  school_id = public.get_my_school_id() AND (
    public.is_super_admin() OR 
    public.get_my_campus_id() IS NULL OR 
    campus_id = public.get_my_campus_id()
  )
)
WITH CHECK (
  public.is_admin() AND 
  school_id = public.get_my_school_id() AND (
    public.is_super_admin() OR 
    public.get_my_campus_id() IS NULL OR 
    campus_id = public.get_my_campus_id()
  )
);

DROP POLICY IF EXISTS "Enable delete for admins on payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Payroll periods delete policy" ON public.payroll_periods;
CREATE POLICY "Payroll periods delete policy" 
ON public.payroll_periods FOR DELETE 
USING (
  public.is_admin() AND 
  school_id = public.get_my_school_id() AND (
    public.is_super_admin() OR 
    public.get_my_campus_id() IS NULL OR 
    campus_id = public.get_my_campus_id()
  )
);


-- ==========================================================
-- 2. SÉCURISATION DE LA TABLE payroll_slips
-- ==========================================================
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users on payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Payroll slips view policy" ON public.payroll_slips;
CREATE POLICY "Payroll slips view policy" 
ON public.payroll_slips FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = public.payroll_slips.period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  ) AND (
    public.is_super_admin() OR
    public.get_my_campus_id() IS NULL OR
    public.payroll_slips.campus_id = public.get_my_campus_id() OR
    (
      public.payroll_slips.campus_id IS NULL AND EXISTS (
        SELECT 1 FROM public.staff 
        WHERE public.staff.id = public.payroll_slips.staff_id 
        AND public.staff.campus_id = public.get_my_campus_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "Enable insert for admins on payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Payroll slips insert policy" ON public.payroll_slips;
CREATE POLICY "Payroll slips insert policy" 
ON public.payroll_slips FOR INSERT 
WITH CHECK (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  ) AND (
    public.is_super_admin() OR
    public.get_my_campus_id() IS NULL OR
    campus_id = public.get_my_campus_id() OR
    (
      campus_id IS NULL AND EXISTS (
        SELECT 1 FROM public.staff 
        WHERE public.staff.id = staff_id 
        AND public.staff.campus_id = public.get_my_campus_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Payroll slips update policy" ON public.payroll_slips;
CREATE POLICY "Payroll slips update policy" 
ON public.payroll_slips FOR UPDATE 
USING (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  ) AND (
    public.is_super_admin() OR
    public.get_my_campus_id() IS NULL OR
    public.payroll_slips.campus_id = public.get_my_campus_id() OR
    (
      public.payroll_slips.campus_id IS NULL AND EXISTS (
        SELECT 1 FROM public.staff 
        WHERE public.staff.id = public.payroll_slips.staff_id 
        AND public.staff.campus_id = public.get_my_campus_id()
      )
    )
  )
)
WITH CHECK (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  ) AND (
    public.is_super_admin() OR
    public.get_my_campus_id() IS NULL OR
    campus_id = public.get_my_campus_id() OR
    (
      campus_id IS NULL AND EXISTS (
        SELECT 1 FROM public.staff 
        WHERE public.staff.id = staff_id 
        AND public.staff.campus_id = public.get_my_campus_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "Enable delete for admins on payroll_slips" ON public.payroll_slips;
DROP POLICY IF EXISTS "Payroll slips delete policy" ON public.payroll_slips;
CREATE POLICY "Payroll slips delete policy" 
ON public.payroll_slips FOR DELETE 
USING (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  ) AND (
    public.is_super_admin() OR
    public.get_my_campus_id() IS NULL OR
    public.payroll_slips.campus_id = public.get_my_campus_id() OR
    (
      public.payroll_slips.campus_id IS NULL AND EXISTS (
        SELECT 1 FROM public.staff 
        WHERE public.staff.id = public.payroll_slips.staff_id 
        AND public.staff.campus_id = public.get_my_campus_id()
      )
    )
  )
);


-- ==========================================================
-- 3. SÉCURISATION DE LA TABLE salary_advances
-- ==========================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'salary_advances') THEN
    ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Salary advances view policy" ON public.salary_advances;
    CREATE POLICY "Salary advances view policy" 
    ON public.salary_advances FOR SELECT 
    USING (
      school_id = public.get_my_school_id() AND (
        public.is_super_admin() OR 
        public.get_my_campus_id() IS NULL OR 
        campus_id = public.get_my_campus_id() OR
        (
          campus_id IS NULL AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = public.salary_advances.staff_id 
            AND public.staff.campus_id = public.get_my_campus_id()
          )
        )
      )
    );

    DROP POLICY IF EXISTS "Salary advances insert policy" ON public.salary_advances;
    CREATE POLICY "Salary advances insert policy" 
    ON public.salary_advances FOR INSERT 
    WITH CHECK (
      public.is_admin() AND 
      school_id = public.get_my_school_id() AND (
        public.is_super_admin() OR 
        public.get_my_campus_id() IS NULL OR 
        campus_id = public.get_my_campus_id() OR
        (
          campus_id IS NULL AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = staff_id 
            AND public.staff.campus_id = public.get_my_campus_id()
          )
        )
      )
    );

    DROP POLICY IF EXISTS "Salary advances update policy" ON public.salary_advances;
    CREATE POLICY "Salary advances update policy" 
    ON public.salary_advances FOR UPDATE 
    USING (
      public.is_admin() AND 
      school_id = public.get_my_school_id() AND (
        public.is_super_admin() OR 
        public.get_my_campus_id() IS NULL OR 
        campus_id = public.get_my_campus_id() OR
        (
          campus_id IS NULL AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = public.salary_advances.staff_id 
            AND public.staff.campus_id = public.get_my_campus_id()
          )
        )
      )
    );

    DROP POLICY IF EXISTS "Salary advances delete policy" ON public.salary_advances;
    CREATE POLICY "Salary advances delete policy" 
    ON public.salary_advances FOR DELETE 
    USING (
      public.is_admin() AND 
      school_id = public.get_my_school_id() AND (
        public.is_super_admin() OR 
        public.get_my_campus_id() IS NULL OR 
        campus_id = public.get_my_campus_id() OR
        (
          campus_id IS NULL AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE public.staff.id = public.salary_advances.staff_id 
            AND public.staff.campus_id = public.get_my_campus_id()
          )
        )
      )
    );
  END IF;
END $$;
