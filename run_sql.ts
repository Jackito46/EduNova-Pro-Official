import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = process.argv[2] || 'init_global_settings.sql';
  const sqlPath = sqlFile.startsWith('/') || sqlFile.startsWith('.') ? sqlFile : `sql/${sqlFile}`;
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Executing SQL from ${sqlPath}...`);
  
  // Try to execute the SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error && error.message.includes('Could not find the function')) {
    console.warn('exec_sql function not found. Please create it manually in the Supabase SQL Editor.');
    console.log('SQL to run:');
    console.log(sql);
  } else {
    console.log('Result:', data, error);
  }
}
run();
