import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFunction() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_my_school_id';" 
  });
  console.log('get_my_school_id definition:', data, error);
}

checkFunction();
