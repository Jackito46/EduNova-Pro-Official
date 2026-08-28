import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('academic_years').select('*').order('missing_col', { ascending: false }).limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success");
  }
}
main();
