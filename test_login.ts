import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
     email: 'jackito46@gmail.com', // wait, is this the user's email?
     password: 'password' // We don't know the password
  });
}
run();
