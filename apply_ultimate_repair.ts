
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyRepair() {
  const sql = fs.readFileSync('ultimate_login_repair.sql', 'utf8');
  
  console.log('Applying Ultimate Login and Schema Repair...');
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  
  if (error) {
    console.error('Error applying repair:', error);
  } else {
    console.log('Repair result:', data);
  }
}

applyRepair();
