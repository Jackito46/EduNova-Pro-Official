import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

const schoolId = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'; // UMDH

async function run() {
  console.log("Checking exchange rates for UMDH:");
  const { data: rates, error } = await supabase.rpc('exec_sql', {
    sql_query: `SELECT * FROM public.exchange_rates WHERE school_id = '${schoolId}' ORDER BY effective_date DESC LIMIT 5`
  });
  console.log("Rates:", rates, "Error:", error);
}

run();
