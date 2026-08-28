import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkColumns() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users'" 
  });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns:', JSON.stringify(data, null, 2));
  }
}
checkColumns();
