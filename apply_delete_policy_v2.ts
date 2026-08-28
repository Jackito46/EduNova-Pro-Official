import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Applying DELETE policy to schools table (Step 1: Create policy)...");
  // We use a query that returns something so EXECUTE INTO result works
  const sql = `CREATE POLICY "schools_delete_super_admin" ON public.schools FOR DELETE USING (is_super_admin()); SELECT true;`;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log("Policy already exists.");
    } else {
        console.error("Error applying policy:", error);
    }
  } else {
    console.log("Policy application result:", data);
  }
}

run();
