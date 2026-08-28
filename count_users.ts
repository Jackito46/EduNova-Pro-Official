import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function countData() {
  const { data: usersCount } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT count(*) FROM auth.users;" 
  });
  console.log('Users Count:', usersCount);

  const { data: ayCount } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT count(*) FROM academic_years;" 
  });
  console.log('Academic Years Count:', ayCount);

  const { data: enrollCount } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT count(*) FROM enrollments;" 
  });
  console.log('Enrollments Count:', enrollCount);
}

countData();
