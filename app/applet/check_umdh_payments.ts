import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const umdhId = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
  const { data } = await supabase.rpc('exec_sql', { sql_query: "SELECT id, school_id, student_id, amount, payment_method, status, nature, type, fee_type FROM payments WHERE school_id = '" + umdhId + "' LIMIT 5" });
  console.log(data);
}
run().catch(console.error);
