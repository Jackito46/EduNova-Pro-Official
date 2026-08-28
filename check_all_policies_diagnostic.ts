
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllPolicies() {
  console.log("Checking ALL RLS policies in the public schema...");
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        tablename, 
        policyname, 
        cmd, 
        qual
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `.trim()
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("All Policies:", JSON.stringify(data, null, 2));
}

checkAllPolicies();
