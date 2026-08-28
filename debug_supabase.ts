import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSupabase() {
  console.log('URL:', supabaseUrl);
  
  // Test auth
  const { data: authData, error: authError } = await supabase.auth.getSession();
  console.log('Auth Session:', authData, authError);

  // Test simple query
  const { data: ayData, error: ayError } = await supabase.from('academic_years').select('count');
  console.log('Academic Years query:', ayData, ayError);

  // Try to list tables via a different RPC if available
  const { data: tables, error: tablesError } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
  console.log('Public Tables (pg_tables):', tables, tablesError);
}

debugSupabase();
