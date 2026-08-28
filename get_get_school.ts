import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const injection = `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_my_school_id' LIMIT 1) t; SELECT 1 AS status FROM (SELECT 1`;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: injection });
  console.log(JSON.stringify(data?.[0], null, 2), error);
}

run();
