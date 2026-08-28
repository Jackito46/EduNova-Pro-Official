import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking schools table via exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT id, name, status FROM public.schools;" 
  });
  
  if (error) {
    console.error("Error executing RPC:", error);
  } else {
    console.log("Schools found:", data);
  }
}

run();
