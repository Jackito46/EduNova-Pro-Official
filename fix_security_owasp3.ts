import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  await supabase.rpc('exec_sql', { sql_query: "REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon, authenticated;" });
  await supabase.rpc('exec_sql', { sql_query: "REVOKE EXECUTE ON FUNCTION public.apply_ddl(text) FROM anon, authenticated;" });
  console.log("Revoked dangerous permissions.");
}

run();
