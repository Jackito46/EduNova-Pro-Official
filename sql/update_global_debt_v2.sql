
-- Mise à jour de la fonction get_student_global_debt pour permettre l'exclusion d'une année (ex: l'année en cours)
-- Cela permet de calculer les "Arriérés" (dettes des années précédentes) sans inclure la session active.

CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID, p_exclude_year_id UUID DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
BEGIN
    -- 1. Calculer tout ce que l'élève aurait dû payer (Scolarité + Frais divers obligatoires)
    -- On exclut l'année passée en paramètre si elle est fournie
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id
    AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id);

    -- 2. Calculer le total des paiements effectués pour les années concernées
    -- On ne compte que les paiements de scolarité et divers pour la dette principale
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id 
    AND fee_type IN ('SCOLARITE', 'DIVERS')
    AND (p_exclude_year_id IS NULL OR academic_year_id IS DISTINCT FROM p_exclude_year_id);

    -- Note: On n'inclut pas le discount_amount ici car il est stocké de manière globale sur l'élève
    -- et s'applique généralement à la session active. Les arriérés sont des dettes nettes reportées.
    
    RETURN GREATEST(v_total_due - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
