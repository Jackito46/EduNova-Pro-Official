import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listSchemas() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT schema_name FROM information_schema.schemata;" 
  });
  console.log('Schemas:', data, error);
}

listSchemas();
