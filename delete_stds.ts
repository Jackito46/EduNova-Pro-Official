import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function run() {
  const sql = `
  DELETE FROM public.subjects 
  WHERE school_id = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'::uuid 
  AND code IN ('FRA-STD', 'CRE-STD', 'MAT-STD', 'ANG-STD', 'ESP-STD', 'PHY-STD', 'CHI-STD', 'SVT-STD', 'PHI-STD', 'ECO-STD', 'INF-STD', 'EPS-STD');
  `;
  const { error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log('Result:', error);
}
run();
