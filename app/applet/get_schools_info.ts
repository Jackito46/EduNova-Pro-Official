import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8');
const supabaseUrlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!supabaseUrlMatch || !supabaseKeyMatch) {
  console.log('Error parsing .env');
  process.exit(1);
}

const supabaseUrl = supabaseUrlMatch[1].trim();
const supabaseKey = supabaseKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('schools').select('id, name, school_type');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

check();
