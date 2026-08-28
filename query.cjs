const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const sql = `SELECT * FROM information_schema.key_column_usage WHERE table_name = 'supply_catalog'`;
  const { data } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data);
})();
