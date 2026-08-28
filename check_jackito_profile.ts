import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').eq('email', 'jackito46@gmail.com');
  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile for jackito46@gmail.com:', data);
  }
}
check();
