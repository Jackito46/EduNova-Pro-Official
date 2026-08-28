import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const {data} = await supabase.rpc('exec_sql', { sql_query: 'SELECT tc.table_name FROM information_schema.columns c LEFT JOIN information_schema.key_column_usage kcu ON kcu.table_name = c.table_name AND kcu.column_name = c.column_name AND kcu.table_schema = 'public' LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name AND tc.constraint_type = 'FOREIGN KEY' WHERE c.column_name = 'student_id' AND c.table_schema = 'public' AND tc.constraint_name IS NULL;' });
  console.log(data);
}
run();