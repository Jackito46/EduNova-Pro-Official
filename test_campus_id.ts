import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey); // with anon key we might not read information_schema due to permissions

// So instead we can just query the table. If campus_id is missing, the query will fail with 42703 (undefined_column).
async function test() {
  const { error } = await supabase.from('school_supplies').select('campus_id').limit(1);
  console.log("school_supplies campus_id Error:", error);

  const { error: err2 } = await supabase.from('supply_catalog').select('campus_id').limit(1);
  console.log("supply_catalog campus_id Error:", err2);

  const { error: err3 } = await supabase.from('expenses').select('campus_id').limit(1);
  console.log("expenses campus_id Error:", err3);
}

test();
