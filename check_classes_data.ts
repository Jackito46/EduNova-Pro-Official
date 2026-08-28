
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('name, level')
    .limit(50);

  if (error) {
    console.error(error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkClasses();
