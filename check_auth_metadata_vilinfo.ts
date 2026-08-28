
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthMetadata() {
  console.log("Checking auth.users metadata for vilinfo2014@gmail.com...");
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        id, 
        email, 
        raw_user_meta_data->>'school_id' as school_id_metadata,
        raw_user_meta_data->>'role' as role_metadata
      FROM auth.users 
      WHERE email = 'vilinfo2014@gmail.com'
    `
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Auth Metadata:", JSON.stringify(data, null, 2));
}

checkAuthMetadata();
