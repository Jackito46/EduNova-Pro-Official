import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jackito46@gmail.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Login error:', authError);
    return;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*, school:schools(name)')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data?.length) {
    console.log('First user:', data[0]);
  }
}
test();
