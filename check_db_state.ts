
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking auth.users count...");
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT jsonb_build_object('count', count(*)) FROM auth.users" 
  });
  
  if (error) {
    console.error("Error executing RPC:", error);
  } else {
    console.log("Auth users count:", data);
  }

  console.log("Checking public.profiles count...");
  const { data: profilesData, error: profilesError } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT jsonb_build_object('count', count(*)) FROM public.profiles" 
  });
  
  if (profilesError) {
    console.error("Error executing RPC for profiles:", profilesError);
  } else {
    console.log("Profiles count:", profilesData);
  }
}

run();
