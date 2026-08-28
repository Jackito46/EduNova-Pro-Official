
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const schoolId = 'a89520ab-3894-49d4-86d8-1421e3012f58'; // Collège Christ VIVANT

async function checkSchema() {
  const tables = ['students', 'enrollments', 'payments', 'academic_years', 'fee_plans'];
  for (const table of tables) {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'` 
    });
    console.log(`Table: ${table}`);
    console.log(data);
  }
}

checkSchema();
