import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDDL() {
  const ddl = "CREATE TABLE IF NOT EXISTS public.test_ddl (id uuid primary key default gen_random_uuid())";
  
  console.log(`Testing exec_sql_v2 with sql_string`);
  const { data: d2, error: e2 } = await supabase.rpc('exec_sql_v2', { sql_string: ddl });
  console.log(`Result from exec_sql_v2:`, d2, e2);

  console.log(`Testing exec_sql with sql_query`);
  const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql_query: ddl });
  console.log(`Result from exec_sql:`, d1, e1);
}
checkDDL();
