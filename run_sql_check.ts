import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function runSql() {
  const sql = fs.readFileSync('./sql/check_auth_users.sql', 'utf8');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error('Error calling exec_sql:', error);
  } else {
    console.log('SQL Executed:', data);
    
    // Now call the function
    const { data: users, error: usersError } = await supabase.rpc('check_auth_users');
    if (usersError) {
      console.error('Error calling check_auth_users:', usersError);
    } else {
      console.log('Auth Users:', JSON.stringify(users, null, 2));
    }
  }
}
runSql();
