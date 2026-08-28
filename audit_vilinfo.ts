import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const email = 'vilinfo2014@gmail.com';
  console.log(`Auditing data for user: ${email}`);

  const sql = `
    SELECT 
        p.id as profile_id,
        p.email,
        p.role,
        p.school_id,
        s.name as school_name
    FROM public.profiles p
    LEFT JOIN public.schools s ON p.school_id = s.id
    WHERE p.email = '${email}'
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Audit failed:', JSON.stringify(error, null, 2));
  } else {
    console.log('Audit Result:', JSON.stringify(data, null, 2));
  }
}
verify();
