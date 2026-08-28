import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = "SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.proname = 'exec_sql';";
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data, error);
}
run();
