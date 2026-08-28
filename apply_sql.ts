import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = process.argv[2];
  const sql = fs.readFileSync(sqlFile, 'utf8').trim();

  // If it's a DDL or multi-statement, we might need a different approach
  // Let's create an RPC that just executes the string
  
  console.log(`Executing SQL from ${sqlFile}...`);
  let result = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (result.error) {
    console.log('Trying as raw query if exec_sql failed...');
    // Some exec_sql implementations might not handle multi-statement CREATE
    // But we are limited by the RPC.
  }

  console.log('Result:', JSON.stringify(result.data, null, 2));
  if (result.error) console.error('Error:', result.error);
}
run();
