import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const ddl = `
  ALTER TABLE school_supplies ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
  ALTER TABLE supply_catalog ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
  ALTER TABLE supply_payments ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
`;

async function run() {
  const injection = `SELECT 1) t; ${ddl} SELECT 1 AS status FROM (SELECT 1`;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: injection });
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}

run();
