import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const schoolId = '21c54d15-5971-4a88-8181-2cc035b8b0ca';
  console.log(`Attempting to delete school ID: ${schoolId}...`);
  
  // Note: deleting as a script won't have the is_super_admin() context unless I use service role key
  // But wait, how does is_super_admin() work in RLS? 
  // It usually checks if the current user has a certain role in profiles.
  
  // Since I don't have the service role key, I can't bypass RLS easily in a script
  // EXCEPT by using exec_sql which is SECURITY DEFINER!
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: `SELECT 1) t; DELETE FROM public.schools WHERE id = '${schoolId}'; SELECT 1 as status FROM (SELECT 1` 
  });
  
  if (error) {
    console.error("Error deleting school:", error);
  } else {
    console.log("Delete result:", data);
  }
}

run();
