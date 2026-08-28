import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sId = 'f06fddee-0b97-47a9-855c-5449b2890fef'; // FRANCOIS Anne

  const query = `
    SELECT public.get_student_global_debt('${sId}', NULL::uuid) as test_debt
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  console.log("Result of direct execution via exec_sql:", data, error);
}

run();
