import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = fs.readFileSync('new_seed.sql', 'utf-8');
  console.log("Applying DDL via exec_ddl...");
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  console.log("Result:", data, error);
}

run();
