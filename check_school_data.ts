import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: p } = await supabase.rpc('exec_sql', { sql_query: "SELECT * FROM profiles WHERE email = 'jackito46@gmail.com'" });
  console.log('Profile:', p);
  const schoolId = p[0].school_id;
  const { data: s } = await supabase.rpc('exec_sql', { sql_query: "SELECT id, name, school_type FROM schools WHERE id = '" + schoolId + "'" });
  console.log('School Info:', s);
  
  const { data: c } = await supabase.rpc('exec_sql', { sql_query: "SELECT name, stage FROM classes WHERE school_id = '" + schoolId + "'" });
  console.log('Classes:', c);
}
run().catch(console.error);
