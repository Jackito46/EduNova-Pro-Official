CREATE OR REPLACE FUNCTION public.seed_level1_students()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school_id UUID;
    v_active_year_id UUID;
    v_class RECORD;
    v_student_id UUID;
    v_first_names TEXT[] := ARRAY['Jean', 'Marie', 'Paul', 'Pierre', 'Jacques', 'Michel', 'Robert', 'Richard', 'Joseph', 'Charles', 'Anne', 'Sophie', 'Isabelle', 'Nathalie', 'Valerie', 'Sylvie', 'Catherine', 'Monique', 'Dominique', 'Claire', 'David', 'Daniel', 'Patrick', 'Christian', 'Claude', 'Bernard', 'Alain', 'Gerard', 'Thierry', 'Pascal'];
    v_last_names TEXT[] := ARRAY['Pierre', 'Joseph', 'Charles', 'Louis', 'Francois', 'Paul', 'Simon', 'Michel', 'Alexis', 'Jean', 'Etienne', 'Jacques', 'Nicolas', 'Antoine', 'Augustin', 'Julien', 'Rene', 'Andre', 'Noel', 'Mathieu'];
    
    v_fn TEXT;
    v_ln TEXT;
    v_parent_fn TEXT;
    v_gender TEXT;
    v_phone TEXT;
    v_dob DATE;
    i INT;
    total_inserted INT := 0;
BEGIN
    -- Get the school ID of the requested user
    SELECT school_id INTO v_school_id FROM profiles WHERE email = 'jackito46@gmail.com' LIMIT 1;
    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'School not found');
    END IF;

    -- Get active academic year
    SELECT id INTO v_active_year_id FROM academic_years WHERE school_id = v_school_id AND status = 'ACTIVE' LIMIT 1;
    IF v_active_year_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'No active year');
    END IF;

    -- Loop through Level I classes
    FOR v_class IN (SELECT id, name FROM classes WHERE school_id = v_school_id AND name LIKE '% I') LOOP
        FOR i IN 1..10 LOOP
            v_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
            v_ln := v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
            v_parent_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
            
            IF random() > 0.5 THEN v_gender := 'M'; ELSE v_gender := 'F'; END IF;
            
            v_phone := '+(509) ' || floor(3000 + random() * 6000)::TEXT || '-' || floor(1000 + random() * 9000)::TEXT;
            v_dob := (DATE '2000-01-01' + floor(random() * 1825)::INT);
            
            -- Insert Student
            INSERT INTO students (school_id, first_name, last_name, parent_name, parent_phone, gender, date_of_birth, status)
            VALUES (v_school_id, v_fn, v_ln, v_parent_fn || ' ' || v_ln, v_phone, v_gender, v_dob, 'ACTIVE')
            RETURNING id INTO v_student_id;
            
            -- Insert Enrollment
            INSERT INTO enrollments (student_id, school_id, class_id, academic_year_id, status, enrollment_date)
            VALUES (v_student_id, v_school_id, v_class.id, v_active_year_id, 'ENROLLED', CURRENT_DATE);
            
            -- Insert Registration Fee (Frais d'inscription)
            INSERT INTO payments (school_id, student_id, academic_year_id, amount, original_amount, payment_method, payment_date, description, reference, status)
            VALUES (v_school_id, v_student_id, v_active_year_id, 5000, 5000, 'CASH', CURRENT_DATE, 'Frais d''inscription', 'INSC-' || floor(random() * 1000000)::TEXT, 'COMPLETED');
            
            total_inserted := total_inserted + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'inserted_students', total_inserted);
END;
$$;
