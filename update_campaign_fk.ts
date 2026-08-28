import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_ad_hoc_campaign_id_fkey;

    ALTER TABLE public.payments
    ADD CONSTRAINT payments_ad_hoc_campaign_id_fkey
    FOREIGN KEY (ad_hoc_campaign_id) REFERENCES public.ad_hoc_campaigns(id)
    ON DELETE RESTRICT;
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  if (error) {
    console.error("Error updating FK:", error);
  } else {
    console.log("FK updated. Deletion of campaigns with payments is now RESTRICTED.");
  }
}

run();
