import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
  SELECT id, amount, currency, nature, fee_type, type, amount_htg_equivalent, reference_number
  FROM payments
  ORDER BY created_at DESC
  LIMIT 5
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("Recent payments via exec_sql:", JSON.stringify(data, null, 2));
}

run();
