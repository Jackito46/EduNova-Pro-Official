-- ==============================================================================
-- OPTIMISATION HAUTE PERFORMANCE : SUPPRESSION DES GOULOTS D'ÉTRANGLEMENT
-- SUR L'AFFICHAGE DE LA LISTE DES PAIEMENTS PAR ÉLÈVE ET PAR ÉCOLE
-- ==============================================================================

-- 1. Index dédié pour la recherche et l'affichage instantané des paiements d'un élève
CREATE INDEX IF NOT EXISTS idx_payments_student_created 
ON public.payments (student_id, created_at DESC);

-- 2. Index composite école + élève pour isoler immédiatement les paiements d'un élève dans son école (Multi-Tenant)
CREATE INDEX IF NOT EXISTS idx_payments_school_student 
ON public.payments (school_id, student_id);

-- 3. Index composite école + session académique
CREATE INDEX IF NOT EXISTS idx_payments_school_academic_year 
ON public.payments (school_id, academic_year_id);

-- 4. Index sur la liaison campagne ad-hoc pour éviter les scans séquentiels lors des jointures
CREATE INDEX IF NOT EXISTS idx_payments_ad_hoc_campaign_id 
ON public.payments (ad_hoc_campaign_id);

-- 5. Index sur les inscriptions par élève pour l'audit instantané des sessions
CREATE INDEX IF NOT EXISTS idx_enrollments_student_school 
ON public.enrollments (student_id, school_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_academic_year 
ON public.enrollments (student_id, academic_year_id);

-- 6. Index sur les frais ad-hoc par élève
CREATE INDEX IF NOT EXISTS idx_student_ad_hoc_fees_student 
ON public.student_ad_hoc_fees (student_id, school_id);

-- 7. Index sur les fournitures scolaires réglées par élève
CREATE INDEX IF NOT EXISTS idx_school_supplies_student_school 
ON public.school_supplies (student_id, school_id);

-- 8. Index sur les plans tarifaires (fee_plans) pour les résolutions rapides
CREATE INDEX IF NOT EXISTS idx_fee_plans_school_class_year 
ON public.fee_plans (school_id, class_id, academic_year_id);

-- 9. Mise à jour des statistiques de l'optimiseur PostgreSQL
ANALYZE public.payments;
ANALYZE public.enrollments;
ANALYZE public.student_ad_hoc_fees;
ANALYZE public.school_supplies;
ANALYZE public.fee_plans;

-- Rechargement du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
