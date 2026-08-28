import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing query on profiles...');
  
  // We don't have a valid session, so RLS will block us unless we query something public.
  // But we can at least see if the schema error happens before RLS.
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error querying profiles:', error);
  } else {
    console.log('Query successful. Data:', data);
  }
}

testQuery();
