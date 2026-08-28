import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function testSeed() {
  const schoolId = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
  
  // Clean up
  await supabase.rpc('exec_sql', { sql_query: `DELETE FROM subjects WHERE school_id = '${schoolId}'`});
  
  // Seed
  const { data, error } = await supabase.rpc('seed_subjects_pro', { target_school_id: schoolId });
  console.log('Seed result:', data, 'Error:', error);
  
  // Verify
  const { data: verify, error: v_error } = await supabase.rpc('exec_sql', { sql_query: `SELECT id, name, code, category FROM subjects WHERE school_id = '${schoolId}' LIMIT 5`});
  console.log('Verification:', verify);
}
testSeed();
