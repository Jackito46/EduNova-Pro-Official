import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sId = 'f06fddee-0b97-47a9-855c-5449b2890fef'; // FRANCOIS Anne

  console.log(`\n--- Detailed query for FRANCOIS Anne (${sId}) ---`);

  // 1. Enrollments in all years
  const { data: enrollments } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT e.id, e.academic_year_id, e.class_id, c.name as class_name, ay.label as year_label
    FROM public.enrollments e
    JOIN public.classes c ON e.class_id = c.id
    JOIN public.academic_years ay ON e.academic_year_id = ay.id
    WHERE e.student_id = '${sId}'
  `});
  console.log("Enrollments:", enrollments);

  // 2. Fee plans
  const { data: feePlans } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT fp.*, c.name as class_name
    FROM public.fee_plans fp
    JOIN public.classes c ON fp.class_id = c.id
    WHERE fp.class_id IN (SELECT class_id FROM public.enrollments WHERE student_id = '${sId}')
  `});
  console.log("Fee Plans related to student's classes:", feePlans);

  // 3. Payments
  const { data: payments } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT p.*
    FROM public.payments p
    WHERE p.student_id = '${sId}'
  `});
  console.log("Payments:", payments);

  // 4. Run the get_student_global_debt RPC for 2025-2026 (assuming exclude_year_id is null)
  // Let's call the specific overload via sql
  const { data: d1 } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT public.get_student_global_debt('${sId}', NULL::uuid) as debt
  `});
  console.log("get_student_global_debt (no exclusion):", d1);

  // 5. Run with exclude_year_id for all years
  const { data: ays } = await supabase.rpc('exec_sql', { sql_query: `SELECT id, label FROM public.academic_years` });
  for (const ay of ays || []) {
    const { data: dExclude } = await supabase.rpc('exec_sql', { sql_query: `
      SELECT public.get_student_global_debt('${sId}', '${ay.id}'::uuid) as debt
    `});
    console.log(`get_student_global_debt (excluding year ${ay.label} [${ay.id}]):`, dExclude);
  }
}

run();
