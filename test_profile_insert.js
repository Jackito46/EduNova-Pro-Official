import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: authError } = await supabase.auth.admin?.listUsers() || { data: null, error: new Error('Admin API not available with anon key') };
  
  if (authError) {
      console.log("Cannot list users with anon key, let's just try to insert a profile directly to see RLS or constraint errors.");
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      { 
        id: '00000000-0000-0000-0000-000000000000', 
        email: 'test@test.com', 
        full_name: 'Test', 
        role: 'SCHOOL_ADMIN', 
        school_id: 'a0ed9087-0554-40ae-ac26-86599a183b16' 
      }
    ]);
    
  console.log('Insert profile result:', { data, error });
}

run();
