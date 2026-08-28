import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: 'SELECT tc.constraint_name, tc.table_name, kcu.column_name, rc.delete_rule FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'students';' });
  console.log(data, error);
}
run();