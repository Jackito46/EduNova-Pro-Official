import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking user...");
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'jackito46@gmail.com')
    .single();
  
  console.log("User:", user, "Error:", userError);

  console.log("Checking school...");
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('*')
    .eq('id', 'a0ed9087-0554-40ae-ac26-86599a183b16')
    .single();
  
  console.log("School:", school, "Error:", schoolError);
}

check();
