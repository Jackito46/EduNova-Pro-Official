import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'class_subjects'
  ` });
  
  if (error) console.error('Error:', error);
  else console.log('Columns:', data);
  
  const { data: policies, error: pError } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT * FROM pg_policies WHERE tablename = 'class_subjects'
  `});
  if (pError) console.error('Error policies:', pError);
  else console.log('Policies:', policies);
}
run();
