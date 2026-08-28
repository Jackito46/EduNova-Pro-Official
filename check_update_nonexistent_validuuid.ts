import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { error } = await supabase.from('schools').update({ NONEXISTENT: 'test' }).eq('id', 'd8ca2f39-2b83-490b-9add-5ce101966dbb');
  console.log('Update error:', error);
}
run();
