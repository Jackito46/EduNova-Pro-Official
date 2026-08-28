import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function main() {
  const { data: profile } = await supabase.rpc('exec_sql', { sql_query: "SELECT school_id FROM profiles WHERE email = 'jackito46@gmail.com'" });
  console.log("Jackito school id:", profile);

  const { data: classes } = await supabase.rpc('exec_sql', { sql_query: "SELECT name, level FROM classes WHERE name LIKE '%&%' LIMIT 20" });
  console.log("Classes with ampersand:", classes);
}
main();
