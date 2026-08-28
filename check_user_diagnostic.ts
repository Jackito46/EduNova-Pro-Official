
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `SELECT id, school_id, role, email FROM profiles WHERE email = 'vilinfo2014@gmail.com'`
  });
  console.log('User Profile:', data, error);
}
checkUser();
