import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.payments'::regclass 
    AND conname = 'payments_payment_method_check'
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // If exec_sql doesn't work, we try to see the table definition via info_schema if possible, 
    // or we just assume based on common patterns.
    console.error("RPC Error:", error);
    
    const { data: cols, error: colErr } = await supabase.from('payments').select('*').limit(1);
    console.log("Columns check:", !colErr);
  } else {
    console.log("Constraint definition:", data);
  }
}
run();
