import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const tables = ['school_supplies', 'communication_logs', 'classes'];
  const results: any[] = [];

  for (const table of tables) {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_string: `SELECT json_agg(column_name) FROM information_schema.columns WHERE table_name = '${table}';` 
    });
    results.push({ table, columns: data, error });
  }
  
  console.log('Columns:', JSON.stringify(results, null, 2));
}

checkColumns();
