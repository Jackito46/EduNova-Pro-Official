import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'communication_settings'" 
  });
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
