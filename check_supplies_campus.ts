import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  const { data, error } = await supabase.from('school_supplies').select('*').limit(1);
  console.log(Object.keys(data?.[0] || {}));
  
  const { data: d2 } = await supabase.from('supply_catalog').select('*').limit(1);
  console.log("cat", Object.keys(d2?.[0] || {}));
}

checkCols();
