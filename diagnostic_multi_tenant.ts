
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error("Missing Anon Key for diagnostic script.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log("--- MULTI-TENANT DIAGNOSTIC ---");
  
  const query = `
    SELECT json_agg(res) FROM (
      WITH table_info AS (
        SELECT 
          t.table_name,
          EXISTS (
            SELECT 1 FROM information_schema.columns c 
            WHERE c.table_name = t.table_name AND c.column_name = 'school_id'
            AND c.table_schema = 'public'
          ) as has_school_id,
          (SELECT rowsecurity FROM pg_class WHERE relname = t.table_name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as rls_enabled
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ),
      policies AS (
        SELECT 
          tablename,
          json_agg(json_build_object('name', policyname, 'cmd', cmd, 'qual', qual, 'with_check', with_check)) as policies_list
        FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY tablename
      )
      SELECT 
        ti.table_name,
        ti.has_school_id,
        ti.rls_enabled,
        COALESCE(p.policies_list, '[]'::json) as policies
      FROM table_info ti
      LEFT JOIN policies p ON ti.table_name = p.tablename
      ORDER BY ti.table_name
    ) res;
  `;

  // Try with sql_query first as the hint suggested
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

  if (error) {
    console.error("Error with sql_query:", error);
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql_string: query });
    if (error2) {
       console.error("Error with sql_string:", error2);
       return;
    }
    console.log(JSON.stringify(data2, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

diagnostic();
