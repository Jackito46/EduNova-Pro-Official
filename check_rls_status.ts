
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log("Checking RLS policies for profiles and schools...");
  
  const { data: policies, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        schemaname, 
        tablename, 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual, 
        with_check 
      FROM pg_policies 
      WHERE tablename IN ('profiles', 'schools')
    `
  });

  if (error) {
    console.error("Error fetching policies:", error);
    return;
  }

  console.log("Policies:", JSON.stringify(policies, null, 2));

  // Also check if is_super_admin exists and its definition
  const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('is_super_admin', 'get_my_school_id', 'is_admin')
    `
  });

  if (funcError) {
    console.error("Error fetching functions:", funcError);
  } else {
    console.log("Functions:", JSON.stringify(functions, null, 2));
  }
}

checkRLS();
