import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'classes'::regclass;"
  });
  console.log(JSON.stringify({data, error}, null, 2));
}

run();
