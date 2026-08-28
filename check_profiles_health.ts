import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT id, email, role, school_id, is_super_admin FROM profiles WHERE school_id IS NULL AND is_super_admin = false) t;" 
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.warn('WARNING: Found profiles without school_id!', data.length);
    console.table(data);
  } else {
    console.log('OK: All regular profiles have a school_id.');
  }
}

checkProfiles();
