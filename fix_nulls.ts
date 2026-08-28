import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNulls() {
  const code = `
    UPDATE auth.users 
    SET 
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, '')
    WHERE id = '6505620c-42bb-4c0a-8730-3c4ff86db136';
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: code });
  console.log("data:", JSON.stringify(data, null, 2));

  // try login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'vilinfo2014@gmail.com',
    password: 'password123'
  });
  console.log("Login error:", loginError);
  console.log("Login data:", loginData);
}

fixNulls();
