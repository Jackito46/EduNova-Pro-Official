
CREATE OR REPLACE FUNCTION public.batch_enroll_students(
    p_school_id UUID,
    p_academic_year_id UUID,
    p_students JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    student_record RECORD;
    v_student_id UUID;
    v_enroll_id UUID;
    v_payment_id UUID;
    v_count INTEGER := 0;
    v_results JSONB := '[]'::jsonb;
BEGIN
    FOR student_record IN SELECT * FROM jsonb_array_elements(p_students) LOOP
        -- 1. Create Student
        INSERT INTO public.students (
            school_id, class_id, first_name, last_name, gender, dob, status, address, parent_name, parent_phone
        ) VALUES (
            p_school_id,
            (student_record.value->>'class_id')::UUID,
            student_record.value->>'first_name',
            student_record.value->>'last_name',
            student_record.value->>'gender',
            (student_record.value->>'dob')::DATE,
            'Inscrit',
            'Port-au-Prince, Haïti',
            (student_record.value->>'last_name') || ' Parent',
            '509' || (40000000 + floor(random() * 59000000))::text
        ) RETURNING id INTO v_student_id;

        -- 2. Enroll Student
        INSERT INTO public.enrollments (
            school_id, student_id, academic_year_id, class_id, status
        ) VALUES (
            p_school_id,
            v_student_id,
            p_academic_year_id,
            (student_record.value->>'class_id')::UUID,
            'Inscrit'
        ) RETURNING id INTO v_enroll_id;

        -- 3. Payment (if applicable)
        IF (student_record.value->>'fee_amount')::NUMERIC > 0 THEN
            INSERT INTO public.payments (
                school_id, student_id, academic_year_id, amount, currency, fee_type, type, nature, method, payment_method, status, date
            ) VALUES (
                p_school_id,
                v_student_id,
                p_academic_year_id,
                (student_record.value->>'fee_amount')::NUMERIC,
                student_record.value->>'currency',
                'Inscription',
                'Revenu',
                'RECOUVREMENT',
                'Cash',
                'Cash',
                'PAID',
                CURRENT_DATE
            ) RETURNING id INTO v_payment_id;
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_enroll_students(UUID, UUID, JSONB) TO anon, authenticated, service_role;
