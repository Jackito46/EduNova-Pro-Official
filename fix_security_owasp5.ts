import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: "REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;" });
  console.log("Result:", data, error);
}

run();
