import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  let ddl = fs.readFileSync('sql/ad_hoc_fees.sql', 'utf-8');
  ddl = ddl.replace(/'/g, "''"); // don't replace quotes, wait, ddl doesn't need quote escaping if passed inside sql_query parameter directly!
  // actually wait, let's just do:
  const injection = `SELECT 1) t; ${fs.readFileSync('sql/ad_hoc_fees.sql', 'utf-8')} SELECT 1 AS status FROM (SELECT 1`;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: injection });
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}
run();
