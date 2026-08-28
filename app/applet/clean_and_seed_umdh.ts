import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
DO $$
DECLARE
    v_school_id UUID := '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'::UUID;
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
    SELECT id INTO v_active_year_id FROM academic_years WHERE school_id = v_school_id AND status = 'ACTIVE' LIMIT 1;
    IF v_active_year_id IS NULL THEN
        RAISE EXCEPTION 'No active year';
    END IF;

    -- Clean existing entries for UMDH
    DELETE FROM payments WHERE school_id = v_school_id;
    DELETE FROM enrollments WHERE school_id = v_school_id;
    DELETE FROM students WHERE school_id = v_school_id;

    -- Insert for specific classes
    FOR v_class IN (
        SELECT id, name, campus_id FROM classes 
        WHERE school_id = v_school_id 
        AND name IN (
            'Médecine Générale I', 
            'Médecine Dentaire I', 
            'Sciences Informatiques I', 
            'Sciences Infirmières I', 
            'Sciences Administratives I'
        )
    ) LOOP
        FOR i IN 1..10 LOOP
            v_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
            v_ln := v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
            v_parent_fn := v_first_names[1 + floor(random() * array_length(v_first_names, 1))];
            
            IF random() > 0.5 THEN v_gender := 'Masculin'; ELSE v_gender := 'Féminin'; END IF;
            
            v_phone := '+(509) ' || floor(3000 + random() * 6000)::TEXT || '-' || floor(1000 + random() * 9000)::TEXT;
            v_dob := (DATE '2000-01-01' + floor(random() * 1825)::INT);
            
            INSERT INTO students (school_id, campus_id, class_id, first_name, last_name, parent_name, parent_phone, parent_relation, gender, dob, status)
            VALUES (v_school_id, v_class.campus_id, v_class.id, v_fn, v_ln, v_parent_fn || ' ' || v_ln, v_phone, 'Père', v_gender, v_dob, 'Actif')
            RETURNING id INTO v_student_id;
            
            INSERT INTO enrollments (student_id, school_id, class_id, academic_year_id, status)
            VALUES (v_student_id, v_school_id, v_class.id, v_active_year_id, 'ACTIVE'); 
            
            INSERT INTO payments (school_id, campus_id, student_id, academic_year_id, amount, method, date, nature, reference_number, status)
            VALUES (v_school_id, v_class.campus_id, v_student_id, v_active_year_id, 10000, 'ESPECES', CURRENT_DATE, 'INSCRIPTION', 'INSC-' || floor(random() * 1000000)::TEXT, 'VALIDE');
            
            total_inserted := total_inserted + 1;
        END LOOP;
    END LOOP;
    
    RAISE LOG 'Inserted % students!', total_inserted;
END $$;
  `;
  
  console.log('Executing DO block via exec_ddl...');
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  
  console.log('Result:', data);
  console.log('Error:', error);
}

run().catch(console.error);
