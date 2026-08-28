import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const ddl = `
  ALTER TABLE school_supplies ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
  ALTER TABLE supply_catalog ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
  ALTER TABLE supply_payments ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES school_campuses(id) ON DELETE SET NULL;
`;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: ddl });
  if (error && error.code === 'PGRST202') {
    // If we only have single arg exec_sql:
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_string: ddl });
    console.log(d2, e2);
  } else {
    console.log(data, error);
  }
}

run();
