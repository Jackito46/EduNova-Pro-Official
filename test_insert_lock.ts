import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const testSchoolId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase.from('resource_locks').insert({
    school_id: testSchoolId,
    resource_type: 'CASH_CLOSURE',
    resource_id: '2026-07-29',
    user_name: JSON.stringify({ status: 'VALIDATED', validatedAt: new Date().toISOString() })
  }).select();
  console.log("Insert result:", data, error);

  if (data && data[0]) {
    const { error: delErr } = await supabase.from('resource_locks').delete().eq('id', data[0].id);
    console.log("Delete result:", delErr);
  }
}
run();
