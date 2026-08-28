import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data } = await supabase.rpc('exec_sql', { sql_query: "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_school_data'" });
  let funcDef = data[0].pg_get_functiondef;
  
  // Informatique keeps 'Informatique%'
  
  // Art Culinaire -> Cuisine
  funcDef = funcDef.replace(/name LIKE 'Art Culinaire%'/g, "name LIKE 'Cuisine%'");

  // Couture -> Couture
  funcDef = funcDef.replace(/name LIKE 'Coupe%'/g, "name LIKE 'Couture%'");

  const { error } = await supabase.rpc('apply_ddl', { v_sql: funcDef });
  console.log("Update error for assignments:", error);
}
main();
