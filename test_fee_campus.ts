import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { error } = await supabase.from('fee_plans').select('campus_id').limit(1);
  console.log("fee_plans campus_id Error:", error);
}

test();
