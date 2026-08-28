import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  const ddl = `
    DROP POLICY IF EXISTS "profiles_standard_access" ON public.profiles;
    CREATE POLICY "profiles_standard_access" ON public.profiles
    FOR ALL USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        school_id = public.get_my_school_id()
    );
  `;

  // THE INJECTION
  const sql = `SELECT 1) t; ${ddl} SELECT 1 as status FROM (SELECT 1`;
  
  console.log(`Applying DDL via injection...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data, error);
}
applyFix();
