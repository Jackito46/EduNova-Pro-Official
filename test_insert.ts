import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data, error } = await supabase.from('academic_years').insert([
    { school_id: 'test-school', label: 'TEST-2025', is_active: false, status: 'VIERGE' }
  ]).select();
  
  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
    // Cleanup
    await supabase.from('academic_years').delete().eq('id', data[0].id);
    console.log('Cleanup Success');
  }
}

testInsert();
