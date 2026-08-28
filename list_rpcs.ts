import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRPCs() {
  console.log('Fetching functions from pg_proc...');
  // We can't query pg_proc directly via from() if not exposed
  // But maybe exec_sql works for some simple queries?
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')" 
  });
  
  if (error) {
    console.error('exec_sql with sql_string failed:', error);
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')" 
    });
    console.log('Result with sql_query:', d2, e2);
  } else {
    console.log('Result with sql_string:', data);
  }
}
listRPCs();
