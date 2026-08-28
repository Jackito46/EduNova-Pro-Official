import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPerms() {
  const code = `
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO anon;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO postgres;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role;
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: code });
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}

fixPerms();
