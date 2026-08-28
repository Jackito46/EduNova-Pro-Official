
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
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
    WHERE schemaname = 'public';

    SELECT 
        p.proname as function_name,
        pg_get_userbyid(p.proowner) as owner,
        p.prosecdef as is_security_definer,
        prosrc as source
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('is_super_admin', 'get_my_school_id', 'get_user_school_id', 'is_super_admin_safe');
  `;
  
  console.log("Checking current RLS state...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Error executing SQL:", error);
  } else {
    console.log("Current RLS State:", JSON.stringify(data, null, 2));
  }
}

run();
