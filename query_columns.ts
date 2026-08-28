import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'resource_locks';";
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data, error);
}
run();
