import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'sql/harden_discounts.sql'), 'utf-8');
  
  // Try using apply_ddl
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  if (error) {
    console.error("Error with apply_ddl:", error);
    // fallback to exec_sql
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_string: sql });
    console.log("Result with exec_sql:", d2, e2);
  } else {
    console.log("Result with apply_ddl:", data);
  }
}

run();
