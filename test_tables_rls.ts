import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = "SELECT polrelid::regclass::text as tablename, polname, polcmd FROM pg_policy WHERE polrelid::regclass::text IN ('global_settings', 'audit_logs', 'payments', 'expenses', 'schools', 'resource_locks');";
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data, error);
}
run();
