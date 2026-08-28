import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('school_supplies').select('*').eq('campus_id', 'a9a3f9e9-1582-45be-b94d-1768461ab1c3').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success");
  }
}
main();
