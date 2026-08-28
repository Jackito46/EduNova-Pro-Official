const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync(".env")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env"));
  for (const k in envConfig) process.env[k] = envConfig[k];
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const query = fs.readFileSync(process.argv[2], 'utf-8');
async function run() {
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: query });
  if(error) console.error("exec_ddl Error:", error);
  else console.log("Success:", data);
}
run();
