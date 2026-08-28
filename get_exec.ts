import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const sql = `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'exec_sql'`;
  const { data } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data);
})();
