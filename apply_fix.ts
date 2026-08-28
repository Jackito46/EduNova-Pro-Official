
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: npx ts-node apply_fix.ts <sql_file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlFile, 'utf8').trim();

  console.log(`Executing DDL from ${sqlFile} using apply_ddl...`);
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  
  if (error) {
    console.error('Error calling apply_ddl:', error);
    process.exit(1);
  }

  console.log('Result:', JSON.stringify(data, null, 2));
}

run();
