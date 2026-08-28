import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync(path.resolve('./create_seed_rpc.sql'), 'utf8');
  
  console.log('Injecting RPC function...');
  const { error: err1 } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (err1) {
      console.error('Error creating RPC:', err1);
      return;
  }
  console.log('RPC injected successfully.');
  
  console.log('Calling RPC function to seed students...');
  const { data, error: err2 } = await supabase.rpc('seed_level1_students');
  if (err2) {
      console.error('Error calling seed_level1_students:', err2);
      return;
  }
  
  console.log('Result:', data);
}

run().catch(console.error);
