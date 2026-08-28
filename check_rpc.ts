
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkRPC() {
  const { data, error } = await supabase.rpc('get_my_school_id');
  if (error) {
    console.log(`get_my_school_id error: ${error.message}`);
  } else {
    console.log(`get_my_school_id result: ${data} (type: ${typeof data})`);
  }
}

checkRPC();
