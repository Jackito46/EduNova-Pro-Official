import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  console.log('Adding constraints via apply_ddl...');
  const sql = \;
  const {data, error} = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log(data, error);
}
run();