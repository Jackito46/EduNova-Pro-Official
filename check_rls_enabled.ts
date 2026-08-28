import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLSEnabled() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public') t;" 
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- RLS Enabled Status ---');
  console.table(data);
}

checkRLSEnabled();
