import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'grades' });
  
  if (error) {
    // Fallback: try to query pg_policies directly if RPC doesn't exist
    console.log("RPC failed, trying direct query if possible or just outputting error:", error);
  } else {
    console.log('Policies for grades:', data);
  }
}

checkPolicies();
