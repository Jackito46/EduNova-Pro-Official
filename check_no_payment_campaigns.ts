import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: campaigns } = await supabase.rpc('exec_sql', { sql_query: "SELECT c.id, c.school_id, c.name, (SELECT count(*) FROM public.payments WHERE ad_hoc_campaign_id = c.id) as payment_count FROM public.ad_hoc_campaigns c WHERE (SELECT count(*) FROM public.payments WHERE ad_hoc_campaign_id = c.id) = 0 LIMIT 5;"});
  console.log("Campaigns without payments:", campaigns);
}

run();
