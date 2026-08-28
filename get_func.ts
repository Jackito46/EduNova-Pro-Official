import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_student_global_debt'"
  });
  console.log(data, error);
}
main();
