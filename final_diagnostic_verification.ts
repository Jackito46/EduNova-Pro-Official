
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalVerify() {
  console.log("Final verification for vilinfo2014@gmail.com...");
  
  // 1. Check if the school exists
  const { data: school, error: schoolErr } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT * FROM schools WHERE id = '21c54d15-5971-4a88-8181-2cc035b8b0ca'"
  });
  console.log("School Existence:", school ? "Found" : "Not Found", schoolErr || "");

  // 2. Check for some counts in fundamental tables to ensure data is there
  const { data: counts, error: countsErr } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        (SELECT count(*) FROM profiles WHERE school_id = '21c54d15-5971-4a88-8181-2cc035b8b0ca') as profile_count,
        (SELECT count(*) FROM students WHERE school_id = '21c54d15-5971-4a88-8181-2cc035b8b0ca') as student_count,
        (SELECT count(*) FROM academic_years WHERE school_id = '21c54d15-5971-4a88-8181-2cc035b8b0ca') as ay_count
    `
  });
  console.log("Data Counts for School:", counts, countsErr || "");

  // 3. Check for any active academic year for this school
  const { data: activeAY, error: ayErr } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT id, label, is_active FROM academic_years WHERE school_id = '21c54d15-5971-4a88-8181-2cc035b8b0ca' AND is_active = true"
  });
  console.log("Active Academic Year:", activeAY, ayErr || "");
}

finalVerify();
