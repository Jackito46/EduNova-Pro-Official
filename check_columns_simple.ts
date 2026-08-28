
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rjhonepcynm2odkbzn2d.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data in profiles table.');
  }
}

check();
