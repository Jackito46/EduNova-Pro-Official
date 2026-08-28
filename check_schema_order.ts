import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { error } = await supabase.from('schools').update({ non_existent_column: 'test', name: 'test' }).eq('id', '123');
  console.log('Update error:', error);
}
run();
