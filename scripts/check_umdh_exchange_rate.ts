import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const schoolId = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490'; // UMDH

async function run() {
  console.log("Checking exchange rates for UMDH:");
  const { data: rates, error } = await supabase.rpc('exec_sql', {
    sql_query: `SELECT * FROM public.exchange_rates WHERE school_id = '${schoolId}' ORDER BY effective_date DESC LIMIT 5`
  });
  console.log("Rates:", rates, "Error:", error);
}

run();
