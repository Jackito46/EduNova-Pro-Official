
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFuncSecurity() {
  console.log("Checking security properties of internal functions...");
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        p.proname as name, 
        p.prosecdef as is_security_definer,
        p.provolatile as volatility
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname IN ('is_super_admin', 'get_my_school_id', 'is_admin')
    `
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Function Security Info:", JSON.stringify(data, null, 2));
}

checkFuncSecurity();
