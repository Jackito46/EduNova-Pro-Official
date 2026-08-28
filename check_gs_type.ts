import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data } = await supabase.from('schools').select('global_settings');
  console.log('global_settings type:', typeof data?.[0]?.global_settings);
}
run();
