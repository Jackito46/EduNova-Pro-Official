-- Fix for get_student_global_debt to EXCLUDE canceled and pending payments.
-- Currently, ANNULÉ, REJETÉ, and EN ATTENTE payments are still counted as valid payments,
-- which artificially reduces the global debt in the system.

DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid);
DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID, p_exclude_year_id UUID DEFAULT NULL::UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_ad_hoc_due NUMERIC := 0;
BEGIN
    -- A. Calculate academic dues (Tuition + Mandatory Misc fees)
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    JOIN public.academic_years ay ON e.academic_year_id = ay.id
    WHERE e.student_id = p_student_id
    -- Exclude specific year if requested
    AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    -- Exclude active/future years from being counted as history/arrears if an exclude year is passed (arrears mode)
    -- Otherwise (absolute balance mode), count active and past years but not future years in preparation.
    AND (
        (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
        OR
        (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
    );

    -- B. Calculate ad_hoc dues
    SELECT COALESCE(SUM(c.amount), 0)
    INTO v_ad_hoc_due
    FROM public.student_ad_hoc_fees s
    JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
    JOIN public.academic_years ay ON c.academic_year_id = ay.id
    WHERE s.student_id = p_student_id
    AND (p_exclude_year_id IS NULL OR c.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    AND (
        (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
        OR
        (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
    );

    v_total_due := v_total_due + v_ad_hoc_due;

    -- C. Calculate payments made (Tuition + Mandatory Misc + Ad Hoc fees)
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments p
    JOIN public.academic_years ay ON p.academic_year_id = ay.id
    WHERE p.student_id = p_student_id 
    AND p.fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC')
    AND (p.status IS NULL OR p.status NOT IN ('ANNULE', 'ANNULÉ'))
    AND (p.payment_method IS NULL OR (p.payment_method NOT ILIKE '%EN ATTENTE%' AND p.payment_method NOT ILIKE '%REJETÉ%'))
    AND (p_exclude_year_id IS NULL OR p.academic_year_id IS DISTINCT FROM p_exclude_year_id)
    AND (
        (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
        OR
        (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
    );

    RETURN GREATEST(v_total_due - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;
