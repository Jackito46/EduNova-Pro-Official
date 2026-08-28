import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments'"
  });
  console.log(data, error);
}
main();
