-- Migration to support re-enrollment fees
ALTER TABLE public.fee_plans ADD COLUMN IF NOT EXISTS reenrollment_fee NUMERIC DEFAULT 0;

-- Update the debt calculation function to account for re-enrollment fees
CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_discount NUMERIC := 0;
BEGIN
    -- 1. Calculate Tuition and Mandatory Misc Fees for all enrollments
    SELECT COALESCE(SUM(
        fp.tuition_fee + 
        CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
    ), 0)
    INTO v_total_due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    WHERE e.student_id = p_student_id;

    -- 2. Calculate Inscription/Re-enrollment Fees
    -- First enrollment pays 'inscription_fee'
    -- Subsequent enrollments pay 'reenrollment_fee'
    WITH enrollment_ranks AS (
        SELECT 
            fp.inscription_fee,
            fp.reenrollment_fee,
            ROW_NUMBER() OVER (ORDER BY e.created_at ASC) as rank
        FROM public.enrollments e
        JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
        WHERE e.student_id = p_student_id
    )
    SELECT v_total_due + COALESCE(SUM(
        CASE 
            WHEN rank = 1 THEN inscription_fee 
            ELSE COALESCE(reenrollment_fee, 0) 
        END
    ), 0)
    INTO v_total_due
    FROM enrollment_ranks;

    -- 3. Subtract discounts
    SELECT COALESCE(discount_amount, 0) INTO v_discount FROM public.students WHERE id = p_student_id;

    -- 4. Calculate total payments
    SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
    INTO v_total_paid
    FROM public.payments
    WHERE student_id = p_student_id;

    RETURN GREATEST(v_total_due - v_discount - v_total_paid, 0);
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
