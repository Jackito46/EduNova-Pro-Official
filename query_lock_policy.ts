import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = "SELECT pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as with_check FROM pg_policy WHERE polname = 'isolation_resource_locks';";
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data, error);
}
run();
