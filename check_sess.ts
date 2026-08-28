import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessions() {
  const code = `
    SELECT count(*) 
    FROM auth.sessions 
    WHERE user_id = '6505620c-42bb-4c0a-8730-3c4ff86db136'
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: code });
  console.log("Sessions:", JSON.stringify(data, null, 2));

  const code2 = `
    DELETE FROM auth.sessions 
    WHERE user_id = '6505620c-42bb-4c0a-8730-3c4ff86db136';
  `;
  await supabase.rpc('apply_ddl', { v_sql: code2 });
  console.log("Deleted sessions");
}

checkSessions();
