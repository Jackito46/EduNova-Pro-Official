import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEnrollments() {
  const { count, error } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Enrollments count:', count);
  }
}

checkEnrollments();
