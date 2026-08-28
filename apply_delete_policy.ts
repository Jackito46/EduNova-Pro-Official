import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Applying DELETE policy to schools table...");
  const sql = `
    DROP POLICY IF EXISTS "schools_delete_super_admin" ON public.schools;
    CREATE POLICY "schools_delete_super_admin" ON public.schools
    FOR DELETE
    USING (is_super_admin());
  `;
  
  // Try with sql_string
  let { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.warn("Retrying with sql_query...");
    ({ data, error } = await supabase.rpc('exec_sql', { sql_query: sql }));
  }
  
  if (error) {
    console.error("Error applying policy:", error);
  } else {
    console.log("Policy application result:", data);
  }
}

run();
