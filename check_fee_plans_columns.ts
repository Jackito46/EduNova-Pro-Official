
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkColumns() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_plans'" 
  });

  if (error) {
    console.error('Error:', error);
    // Try other variation
     const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { 
        sql_string: "SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_plans'" 
      });
      if (error2) console.error('Error2:', error2);
      else console.log('Columns:', data2);
    return;
  }

  console.log('Columns:', data);
}

checkColumns();
