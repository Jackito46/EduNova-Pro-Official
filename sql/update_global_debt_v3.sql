-- Fix for get_student_global_debt to support Multi-Tenancy and precise balance calculation.
-- This function includes p_school_id filtering to guarantee tenant isolation, and incorporates 
-- tuition discounts, student-specific discounts, and tuition additions from the enrollment record.

DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid);
DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_student_global_debt(
    p_student_id UUID, 
    p_exclude_year_id UUID DEFAULT NULL::UUID,
    p_school_id UUID DEFAULT NULL::UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_ad_hoc_due NUMERIC := 0;
BEGIN
    -- A. Calculate academic dues (Tuition + Mandatory Misc fees - Discounts + Additions)
    SELECT COALESCE(SUM(
        GREATEST(0, 
            COALESCE(fp.tuition_fee, 0) 
            - COALESCE(e.tuition_discount, 0) 
            - COALESCE(s.discount_amount, 0) 
            + COALESCE(e.tuition_addition, 0)
        ) + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    JOIN public.academic_years ay ON e.academic_year_id = ay.id
    JOIN public.students s ON e.student_id = s.id
    WHERE e.student_id = p_student_id
    AND (p_school_id IS NULL OR e.school_id = p_school_id)
    AND (p_school_id IS NULL OR fp.school_id = p_school_id)
    AND (p_school_id IS NULL OR s.school_id = p_school_id)
    -- Exclude specific year if requested
    AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    -- Count active and past years, excluding future years in preparation unless they are the current selected target.
    AND ay.status IN ('PAST', 'ACTIVE');

    -- B. Calculate ad_hoc dues
    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_ad_hoc_due
    FROM public.student_ad_hoc_fees s
    JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
    JOIN public.academic_years ay ON c.academic_year_id = ay.id
    WHERE s.student_id = p_student_id
    AND (p_school_id IS NULL OR s.school_id = p_school_id)
    AND (p_school_id IS NULL OR c.school_id = p_school_id)
    AND (p_exclude_year_id IS NULL OR c.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    AND ay.status IN ('PAST', 'ACTIVE');

    v_total_due := v_total_due + v_ad_hoc_due;

    -- C. Calculate payments made (Tuition + Mandatory Misc + Ad Hoc fees)
    SELECT COALESCE(SUM(COALESCE(p.amount_htg_equivalent, p.amount)), 0)
    INTO v_total_paid
    FROM public.payments p
    JOIN public.academic_years ay ON p.academic_year_id = ay.id
    WHERE p.student_id = p_student_id 
    AND (p_school_id IS NULL OR p.school_id = p_school_id)
    AND p.fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC')
    AND (p_exclude_year_id IS NULL OR p.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    AND ay.status IN ('PAST', 'ACTIVE');

    RETURN GREATEST(v_total_due - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;
