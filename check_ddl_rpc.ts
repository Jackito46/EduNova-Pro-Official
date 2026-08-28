import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDDL() {
  const ddl = "CREATE TABLE IF NOT EXISTS public.test_ddl (id uuid primary key default gen_random_uuid())";
  
  const rpcs = ['exec_sql', 'exec_sql_v2', 'apply_safe_rls', 'run_query'];
  
  for (const rpc of rpcs) {
    console.log(`Testing RPC: ${rpc}`);
    try {
      const { data, error } = await supabase.rpc(rpc, { 
        sql_string: ddl,
        sql_query: ddl,
        query: ddl,
        sql: ddl
      });
      console.log(`Result from ${rpc}:`, data, error);
    } catch (e) {
      console.error(`Error calling ${rpc}:`, e);
    }
  }
}
checkDDL();
