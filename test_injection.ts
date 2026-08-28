import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInjection() {
  const sql = "1) t; CREATE TABLE IF NOT EXISTS public.injection_test(); SELECT 1 as status FROM (SELECT 1";
  
  console.log(`Testing injection: ${sql}`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data, error);

  // Check if table exists
  const { data: check, error: cError } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT tablename FROM pg_tables WHERE tablename = 'injection_test'" 
  });
  console.log('Table check:', check, cError);
}
testInjection();
