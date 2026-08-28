
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalConfig() {
  const schoolId = '21c54d15-5971-4a88-8181-2cc035b8b0ca';
  const ayId = '4eea613c-6695-4d5b-ab5b-055c25443f0e';

  console.log("Activating academic year...");
  await supabase.rpc('exec_sql', { 
    sql_query: `UPDATE academic_years SET is_active = true WHERE id = '${ayId}'` 
  });
  
  console.log("Updating school settings...");
  const jsonValue = `"${ayId}"`;
  await supabase.rpc('exec_sql', {
    sql_query: `UPDATE schools SET global_settings = jsonb_set(COALESCE(global_settings, '{}'::jsonb), '{academic_year_id}', '${jsonValue}'::jsonb) WHERE id = '${schoolId}'`
  });

  console.log('Final configuration applied.');
}

finalConfig();
