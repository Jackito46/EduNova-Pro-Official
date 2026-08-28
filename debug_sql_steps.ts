import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sId = 'f06fddee-0b97-47a9-855c-5449b2890fef'; // FRANCOIS Anne

  console.log(`\n--- STEP-BY-STEP SQL DEBUG FOR FRANCOIS Anne ---`);

  // Part A (Dues) with p_exclude_year_id = NULL
  const queryDuesNull = `
    SELECT e.academic_year_id, ay.status, fp.tuition_fee, 
           (fp.tuition_fee + CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END) as due
    FROM public.enrollments e
    JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
    JOIN public.academic_years ay ON e.academic_year_id = ay.id
    WHERE e.student_id = '${sId}'
    AND ay.status IN ('PAST', 'ACTIVE')
  `;
  const { data: dDuesNull, error: errDuesNull } = await supabase.rpc('exec_sql', { sql_query: queryDuesNull });
  if (errDuesNull) console.error("Error dues null:", errDuesNull);
  else console.log("Part A (Dues) Null Exclude status check:", dDuesNull);

  // Part C (Payments) with NULL
  const queryPaidNull = `
    SELECT p.id, p.amount, p.amount_htg_equivalent, p.fee_type, ay.status
    FROM public.payments p
    JOIN public.academic_years ay ON p.academic_year_id = ay.id
    WHERE p.student_id = '${sId}'
    AND p.fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC')
    AND ay.status IN ('PAST', 'ACTIVE')
  `;
  const { data: dPaidNull, error: errPaidNull } = await supabase.rpc('exec_sql', { sql_query: queryPaidNull });
  if (errPaidNull) console.error("Error paid null:", errPaidNull);
  else console.log("Part C (Payments) Null Exclude status check:", dPaidNull);
}

run();
