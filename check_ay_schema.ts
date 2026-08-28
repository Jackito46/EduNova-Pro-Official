import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAcademicYearsSchema() {
  const { data, error } = await supabase.from('academic_years').select('*').limit(1);
  
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Data in academic_years:');
    console.log(data);
  }
}

checkAcademicYearsSchema();
