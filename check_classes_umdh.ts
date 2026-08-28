import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: campusesResult } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT id, name FROM school_campuses WHERE school_id = '3dd425c2-2e23-4e3c-a502-c67ed85ca490' OR school_id = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'" 
  });
  console.log('Campuses found:', campusesResult);

  const { data: classesResult } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT campus_id, COUNT(*), STRING_AGG(DISTINCT name, ', ') as names_sample FROM classes GROUP BY campus_id" 
  });
  console.log('Classes by campus:', classesResult);
}
run().catch(console.error);
