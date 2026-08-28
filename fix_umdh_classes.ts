import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
  DELETE FROM classes 
  WHERE school_id IN (SELECT id FROM schools WHERE school_type = 'UNIVERSITY')
  AND (
    name IN ('Petite Section', 'Moyenne Section', 'Grande Section', 
            '1ère AF', '2ème AF', '3ème AF', '4ème AF', '5ème AF', '6ème AF', 
            '7ème AF', '8ème AF', '9ème AF', 'NS I', 'NS II', 'NS III', 'NS IV')
  );
  `;
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  console.log('Result:', data);
  console.log('Error:', error);
}
run().catch(console.error);
