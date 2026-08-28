import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixHash() {
  const code = `
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf', 10))
    WHERE email = 'vilinfo2014@gmail.com';
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: code });
  console.log("data:", JSON.stringify(data, null, 2));
}

fixHash();
