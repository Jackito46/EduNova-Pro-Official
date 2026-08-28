import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createFunc() {
  const sql = `
  CREATE OR REPLACE FUNCTION admin_delete_push_subscription(p_endpoint TEXT)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
  END;
  $$;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Exec RPC Failed, trying REST:", error);
    // manual fallback is not possible without a direct query executor, assume we'll just ignore for now if it fails, or it was already created. Wait, a better way is to just do it via normal setup if we have direct pg access. We don't.
    // wait, I can just use supabase.from('push_subscriptions').delete().eq('endpoint', p_endpoint) with service_role key directly in the server!
  }
}
createFunc();
