import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('school_supplies', 'supply_catalog', 'expenses', 'supply_payments');
  `});
  console.log(data, error);
}

run();
