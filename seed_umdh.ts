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
    i INT;
    total_inserted INT := 0;
BEGIN
    SELECT id INTO v_active_year_id FROM academic_years WHERE school_id = v_school_id AND status = 'ACTIVE' LIMIT 1;

    IF v_active_year_id IS NOT NULL THEN
        FOR v_class IN (SELECT id, name FROM classes WHERE school_id = v_school_id LIMIT 3) LOOP
            FOR i IN 1..5 LOOP
                INSERT INTO students (school_id, class_id, first_name, last_name, gender, status, dob, parent_name, parent_phone, parent_relation)
                VALUES (v_school_id, v_class.id, 'Student' || i, 'Test ' || v_class.name, 'Masculin', 'Actif', '2000-01-01', 'Parent', '12345678', 'Père')
                RETURNING id INTO v_student_id;
                
                INSERT INTO enrollments (student_id, school_id, class_id, academic_year_id, status)
                VALUES (v_student_id, v_school_id, v_class.id, v_active_year_id, 'ACTIVE'); 
                
                INSERT INTO payments (school_id, student_id, academic_year_id, amount, method, date, nature, reference_number, status)
                VALUES (v_school_id, v_student_id, v_active_year_id, 10000, 'ESPECES', CURRENT_DATE, 'INSCRIPTION', 'INSC-' || floor(random() * 1000000)::TEXT, 'VALIDE');
                
                total_inserted := total_inserted + 1;
            END LOOP;
        END LOOP;
        RAISE LOG 'Inserted % students into UMDH!', total_inserted;
    END IF;
END $$;
  `;
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  console.log('Result:', data);
  console.log('Error:', error);
}
run().catch(console.error);
