import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking foreign keys pointing to schools table...");
  const sql = `SELECT 1) t;
    SELECT
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
    FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON rc.unique_constraint_name = ccu.constraint_name
          AND rc.unique_constraint_schema = ccu.table_schema
    WHERE
        ccu.table_name = 'schools'
        AND tc.constraint_type = 'FOREIGN KEY' -- `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Error executing RPC:", error);
  } else {
    console.log("Foreign keys to schools:", data);
  }
}

run();
