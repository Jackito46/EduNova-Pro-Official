import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = ['students', 'enrollments', 'payments'];
  for (const table of tables) {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`
    });
    console.log(`=== Columns of ${table} ===`);
    console.log(data);
  }
}

run();
