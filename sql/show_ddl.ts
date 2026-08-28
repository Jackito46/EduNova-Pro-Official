import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.rpc('exec_sql', { sql_query: 'SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 35013501$' });
  console.log(data);
}
run();