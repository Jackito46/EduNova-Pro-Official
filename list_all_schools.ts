
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkSchools() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT id, name FROM public.schools' });
  if (error) console.error(error);
  console.log('Schools (SQL):', data);
}

checkSchools();
