import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHook() {
  const code = `
    SELECT public.custom_access_token_hook(
      jsonb_build_object(
        'user_id', '6505620c-42bb-4c0a-8730-3c4ff86db136',
        'claims', jsonb_build_object(
          'app_metadata', jsonb_build_object()
        )
      )
    )
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: code });
  console.log("Hook result:", JSON.stringify(data, null, 2));
}

testHook();
