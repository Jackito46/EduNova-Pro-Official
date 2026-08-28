import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const code = `
    SELECT trigger_name, event_manipulation, event_object_schema, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: code });
  console.log("Triggers on auth:", JSON.stringify(data, null, 2));

  const code2 = `
    SELECT proname FROM pg_proc WHERE proname LIKE 'custom_access_token_hook'
  `;
  const { data: data2 } = await supabase.rpc('exec_sql', { sql_query: code2 });
  console.log("Hook:", JSON.stringify(data2, null, 2));
}

checkTriggers();
