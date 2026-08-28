import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: "REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated; REVOKE EXECUTE ON FUNCTION public.apply_ddl(text) FROM PUBLIC, anon, authenticated;" });
  console.log("Result:", data, error);
}

run();
