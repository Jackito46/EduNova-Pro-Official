import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jackito46@gmail.com',
    password: 'securepassword123'
  });
  if (authError) {
      console.log("Auth error", authError);
      return;
  }
  const { data, error } = await supabase.from('academic_years').select('*').eq('school_id', 'school-2025-premium').order('label', { ascending: false }).limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data:", data);
  }
}
main();
