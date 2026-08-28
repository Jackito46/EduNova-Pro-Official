import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const tables = ['salary_advances', 'staff_salaries', 'payments', 'school_supplies'];
  for (const table of tables) {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_string: `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'` 
    });
    console.log(`Table: ${table}`);
    if (error) console.error(error);
    else {
      if (Array.isArray(data)) {
        console.log(data.map((r: any) => r.column_name));
      } else {
        console.log(data);
      }
    }
  }
}
run();
