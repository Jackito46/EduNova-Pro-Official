import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSeed() {
  const testSchoolId = '00000000-0000-0000-0000-000000000000'; // dummy
  
  console.log(`Testing seed_school_data with ${testSchoolId}...`);
  
  const { data, error } = await supabase.rpc('seed_school_data', { 
    p_school_id: testSchoolId 
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Response:', data);
  }
}

testSeed();
