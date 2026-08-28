import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.rpc('get_schools_columns').select();
  if (error) {
     const { data: d2 } = await supabase.from('schools').select('*');
     if (d2 && d2.length > 0) {
         console.log(Object.keys(d2[0]));
     } else {
         console.log('No rows returned, inserting a dummy row to test? No.');
     }
  }
}
run();
