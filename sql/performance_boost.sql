
-- ==========================================================
-- PACK PERFORMANCE EDUNOVA PRO - v9.5
-- OPTIMISATION DES TEMPS DE CHARGEMENT DASHBOARD
-- ==========================================================

-- 1. Indexation pour les jointures rapides (Foreign Keys)
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_year ON public.payments(student_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_payments_school ON public.payments(school_id);
CREATE INDEX IF NOT EXISTS idx_expenses_academic_year ON public.expenses(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_academic_year ON public.fee_plans(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_id ON public.staff_assignments(staff_id);

-- 2. Indexation pour le filtrage par école (SaaS Isolation)
CREATE INDEX IF NOT EXISTS idx_supply_catalog_school ON public.supply_catalog(school_id);
CREATE INDEX IF NOT EXISTS idx_school_supplies_school ON public.school_supplies(school_id);

-- 3. Mise à jour des statistiques de l'optimiseur Postgres
ANALYZE public.students;
ANALYZE public.payments;
ANALYZE public.fee_plans;
ANALYZE public.expenses;

NOTIFY pgrst, 'reload schema';
