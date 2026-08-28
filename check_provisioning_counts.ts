import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSeeding() {
  const schoolId = '21c54d15-5971-4a88-8181-2cc035b8b0ca'; // From audit result
  
  const queries = {
    ay: `SELECT count(*) FROM public.academic_years WHERE school_id = '${schoolId}'`,
    classes: `SELECT count(*) FROM public.classes WHERE school_id = '${schoolId}'`,
    subjects: `SELECT count(*) FROM public.subjects WHERE school_id = '${schoolId}'`
  };

  for (const [key, sql] of Object.entries(queries)) {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    console.log(`${key}:`, data, error);
  }
}
checkSeeding();
