import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function test() {
  const sql = "SELECT id, created_at, date, payment_method, amount, status FROM payments ORDER BY created_at DESC LIMIT 5;";
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Payments:', data, error);
}
test();
