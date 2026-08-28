import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking audit_logs for DELETE school action...");
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT * FROM public.audit_logs WHERE action = 'DELETE' AND entity_type = 'school' ORDER BY created_at DESC LIMIT 5;" 
  });
  
  if (error) {
    console.error("Error executing RPC:", error);
  } else {
    console.log("Delete audit logs:", data);
  }
}

run();
