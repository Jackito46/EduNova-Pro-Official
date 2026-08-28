import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: "SELECT 1;" });
  console.log("Test execution:", error ? "Blocked (Success!)" : "Executed (Failed!)", error);
}

run();
