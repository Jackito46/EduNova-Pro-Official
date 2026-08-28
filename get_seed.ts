import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const sql = `SELECT prosrc FROM pg_proc WHERE proname = 'seed_school_data'`;
  const { data } = await supabase.rpc('exec_sql', { sql_query: sql });
  fs.writeFileSync('current_seed.sql', data[0].prosrc);
})();
