import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('school_supplies').select('*').eq('campus_id', 'some-id').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success");
  }
}
main();
