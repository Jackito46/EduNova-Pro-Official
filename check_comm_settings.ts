import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data, error } = await supabase.from('communication_settings').select('*');
  if (error) {
    console.error('Error fetching communication_settings:', error);
  } else {
    console.log('Communication Settings:', data);
  }
}
check();
