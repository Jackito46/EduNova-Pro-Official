import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTableType() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT table_name, table_type FROM information_schema.tables WHERE table_name IN ('active_sessions', 'session_policies', 'global_settings')) t;" 
  });
  console.log('Table Types:', data, error);
}

checkTableType();
