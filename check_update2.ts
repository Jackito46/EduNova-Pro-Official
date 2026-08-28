import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { error } = await supabase.from('schools').update({ director_name: 'test', license_number: '123' }).eq('id', '123');
  console.log('Update director_name error:', error);
}
run();
