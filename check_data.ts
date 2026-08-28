
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkData() {
  const { data: schools, error: sError } = await supabase.from('schools').select('id, name');
  console.log('Schools:', schools);

  const { data: classes, error: cError } = await supabase.from('classes').select('name, level, school_id');
  console.log('Classes:', classes);
}

checkData();
