import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
  WITH user_school AS (
      SELECT school_id FROM public.profiles WHERE email = 'jackito46@gmail.com' LIMIT 1
  ),
  active_year AS (
      SELECT id FROM public.academic_years WHERE school_id = (SELECT school_id FROM user_school) AND status = 'ACTIVE' LIMIT 1
  ),
  level_1_classes AS (
      SELECT id AS class_id FROM public.classes WHERE school_id = (SELECT school_id FROM user_school) AND name LIKE '% I'
  ),
  generated_students AS (
      SELECT 
          c.class_id,
          (SELECT school_id FROM user_school) AS school_id,
          (SELECT id FROM active_year) AS academic_year_id,
          (ARRAY['Jean', 'Marie', 'Paul', 'Pierre', 'Jacques', 'Michel', 'Robert', 'Richard', 'Joseph', 'Charles', 'Anne', 'Sophie', 'Isabelle', 'Nathalie', 'Valerie', 'Sylvie', 'Catherine', 'Monique', 'Dominique', 'Claire', 'David', 'Daniel', 'Patrick', 'Christian', 'Claude', 'Bernard', 'Alain', 'Gerard', 'Thierry', 'Pascal'])[1 + floor(random() * 30)::INT] AS first_name,
          (ARRAY['Pierre', 'Joseph', 'Charles', 'Louis', 'Francois', 'Paul', 'Simon', 'Michel', 'Alexis', 'Jean', 'Etienne', 'Jacques', 'Nicolas', 'Antoine', 'Augustin', 'Julien', 'Rene', 'Andre', 'Noel', 'Mathieu'])[1 + floor(random() * 20)::INT] AS last_name,
          CASE WHEN random() > 0.5 THEN 'M' ELSE 'F' END AS gender,
          '+(509) ' || floor(3000 + random() * 6000)::TEXT || '-' || floor(1000 + random() * 9000)::TEXT AS parent_phone,
          (DATE '2000-01-01' + floor(random() * 1825)::INT) AS dob,
          'ACTIVE' AS status,
          gen.id AS row_num
      FROM level_1_classes c
      CROSS JOIN generate_series(1, 10) gen(id)
  ),
  inserted_students AS (
      INSERT INTO public.students (school_id, class_id, first_name, last_name, parent_name, parent_phone, gender, dob, status)
      SELECT 
          school_id, 
          class_id,
          first_name, 
          last_name, 
          (ARRAY['Marie', 'Paul', 'Pierre', 'Jacques', 'Anne'])[1 + floor(random() * 5)::INT] || ' ' || last_name AS parent_name,
          parent_phone, 
          gender, 
          dob, 
          status
      FROM generated_students
      RETURNING id, school_id, first_name, last_name, class_id
  ),
  student_assignments AS (
      SELECT id AS student_id, school_id, class_id, row_number() over() as seq FROM inserted_students
  ),
  class_assignments AS (
      SELECT class_id, academic_year_id, row_number() over() as seq FROM generated_students
  ),
  inserted_enrollments AS (
      INSERT INTO public.enrollments (student_id, school_id, class_id, academic_year_id, status, enrollment_date)
      SELECT s.student_id, s.school_id, s.class_id, c.academic_year_id, 'ENROLLED', CURRENT_DATE
      FROM student_assignments s
      JOIN class_assignments c ON s.seq = c.seq
      RETURNING id, student_id, school_id, class_id, academic_year_id
  ),
  inserted_payments AS (
      INSERT INTO public.payments (school_id, student_id, academic_year_id, amount, original_amount, payment_method, payment_date, description, reference, status)
      SELECT school_id, student_id, academic_year_id, 5000, 5000, 'CASH', CURRENT_DATE, 'Frais d''inscription', 'INSC-' || substring(student_id::text from 1 for 6), 'COMPLETED'
      FROM inserted_enrollments
      RETURNING id
  )
  SELECT jsonb_build_object(
      'students_inserted', (SELECT count(*) FROM inserted_students),
      'enrollments_inserted', (SELECT count(*) FROM inserted_enrollments),
      'payments_inserted', (SELECT count(*) FROM inserted_payments)
  ) AS result
  `;
  
  console.log('Executing CTE via exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  console.log('Result:', data);
  console.log('Error:', error);
}

run().catch(console.error);
