import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: logs } = await supabase.from('audit_logs').select('action, details, created_at').order('created_at', { ascending: false }).limit(20);
  console.log("Recent audit logs:", logs);
}
check();
