import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking foreign keys pointing to schools table...");
  const sql = `
    SELECT
        tc.table_name,
        rc.delete_rule
    FROM
        information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE
        ccu.table_name = 'schools'
        AND tc.constraint_type = 'FOREIGN KEY'
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Error executing RPC:", error);
  } else {
    console.log("Foreign keys to schools:", data);
  }
}

run();
