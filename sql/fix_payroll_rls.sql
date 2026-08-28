-- ==========================================================
-- SCRIPT DE CORRECTION MULTI-TENANT POUR LA PAIE
-- ==========================================================

-- Ce script renforce la sécurité (RLS) des tables de paie
-- pour s'assurer qu'une école ne peut voir et modifier QUE ses propres données.

-- 1. Sécurisation de la table payroll_periods
DROP POLICY IF EXISTS "Enable read access for all users on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Payroll periods view policy" 
ON public.payroll_periods FOR SELECT 
USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Enable insert for admins on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Payroll periods insert policy" 
ON public.payroll_periods FOR INSERT 
WITH CHECK (
  public.is_admin() AND school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Payroll periods update policy" 
ON public.payroll_periods FOR UPDATE 
USING (
  public.is_admin() AND school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Enable delete for admins on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Payroll periods delete policy" 
ON public.payroll_periods FOR DELETE 
USING (
  public.is_admin() AND school_id = public.get_my_school_id()
);


-- 2. Sécurisation de la table payroll_slips
DROP POLICY IF EXISTS "Enable read access for all users on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Payroll slips view policy" 
ON public.payroll_slips FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = public.payroll_slips.period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  )
);

DROP POLICY IF EXISTS "Enable insert for admins on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Payroll slips insert policy" 
ON public.payroll_slips FOR INSERT 
WITH CHECK (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  )
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Payroll slips update policy" 
ON public.payroll_slips FOR UPDATE 
USING (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  )
);

DROP POLICY IF EXISTS "Enable delete for admins on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Payroll slips delete policy" 
ON public.payroll_slips FOR DELETE 
USING (
  public.is_admin() AND 
  EXISTS (
    SELECT 1 FROM public.payroll_periods 
    WHERE public.payroll_periods.id = period_id 
    AND public.payroll_periods.school_id = public.get_my_school_id()
  )
);
