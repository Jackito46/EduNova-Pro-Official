-- Mise à jour de la fonction get_student_global_debt pour supporter le multi-devises
CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_discount NUMERIC := 0;
BEGIN
    -- 1. Calculer tout ce que l'élève aurait dû payer (Scolarité + Frais divers obligatoires) pour chaque année où il était inscrit
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    -- 2. Ajouter les frais d'inscription une seule fois (pour la toute première année d'inscription à l'école)
    SELECT COALESCE(fp.inscription_fee, 0)
    INTO v_total_due
    FROM (
        SELECT fp.inscription_fee
        FROM public.enrollments e
        JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
        WHERE e.student_id = p_student_id
        ORDER BY e.created_at ASC
        LIMIT 1
    ) AS first_year_fee;

    -- On rajoute les frais d'inscription au total dû
    -- Note: v_total_due contient déjà la somme des scolarités, on doit lui ajouter l'inscription
    SELECT (
        COALESCE(SUM(fp.tuition_fee + CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END), 0) +
        COALESCE((
            SELECT fp.inscription_fee
            FROM public.enrollments e
            JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
            WHERE e.student_id = p_student_id
            ORDER BY e.created_at ASC
            LIMIT 1
        ), 0)
    )
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    -- 2. Soustraire les réductions accordées (actuellement stockées sur la table student, mais on pourrait les historiser plus tard)
    -- Pour l'instant on considère que la réduction s'applique sur l'année en cours
    SELECT COALESCE(discount_amount, 0) INTO v_discount FROM public.students WHERE id = p_student_id;

    -- 3. Calculer le total des paiements effectués (en utilisant l'équivalent HTG ou le montant brut si ancien)
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id;

    RETURN GREATEST(v_total_due - v_discount - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
