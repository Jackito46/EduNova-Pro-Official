import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_schema_info', { table_name: 'active_sessions' });
  console.log("RPC error:", error);
  
  // Alternative way to get columns if RPC fails
  const { error: insertError } = await supabase.from('active_sessions').insert({ non_existent_col: 1 }).select();
  console.log("Insert error:", insertError);
}

checkColumns();
