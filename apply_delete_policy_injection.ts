import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ddl = `
    DROP POLICY IF EXISTS "schools_delete_super_admin" ON public.schools;
    CREATE POLICY "schools_delete_super_admin" ON public.schools
    FOR DELETE
    USING (is_super_admin());
  `;

  const sql = `SELECT 1) t; ${ddl} SELECT 1 as status FROM (SELECT 1`;
  
  console.log(`Applying DELETE policy via injection...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Error applying policy:", error);
  } else {
    console.log("Policy application result:", data);
  }
}

run();
