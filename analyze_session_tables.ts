import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'academic_year_id'" 
  });
  if (error) console.error(error);
  else {
    const tables = Array.from(new Set(data.map((r: any) => r.table_name)));
    console.log('Tables with academic_year_id:', tables);
  }

  const { data: allTables, error: err2 } = await supabase.rpc('exec_sql', {
    sql_string: "SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public'"
  });
  if (err2) console.error(err2);
  else {
    const tablesWithoutSession = allTables.filter((t: any) => !data.some((r: any) => r.table_name === t.table_name));
    console.log('Tables without academic_year_id:', tablesWithoutSession.map((t: any) => t.table_name));
  }
}
run();
