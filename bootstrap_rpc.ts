
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function bootstrapRpc() {
  const sql = fs.readFileSync('fix_rpc_v4.sql', 'utf8').trim();
  
  console.log("Trying to deploy fix_rpc_v4.sql using sql_query...");
  let { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Failed with sql_query:", error);
    console.log("Trying with sql_string...");
    ({ data, error } = await supabase.rpc('exec_sql', { sql_string: sql }));
  }

  if (error) {
    console.error("Failed both:", error);
  } else {
    console.log("Success! RPC updated.");
    console.log("Result:", JSON.stringify(data, null, 2));
  }
}

bootstrapRpc();
