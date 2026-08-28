import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEnrollments() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT count(*) as total, count(academic_year_id) as with_ay FROM enrollments) t;" 
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- Enrollments Check ---');
  console.table(data);

  const { data: orphans, error: orphanError } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT id, student_id, school_id FROM enrollments WHERE academic_year_id IS NULL OR academic_year_id NOT IN (SELECT id FROM academic_years)) t;" 
  });

  if (orphanError) {
    console.error('Orphan Error:', orphanError);
  } else if (orphans && orphans.length > 0) {
    console.warn('WARNING: Found orphan enrollments!', orphans.length);
    console.table(orphans);
  } else {
    console.log('OK: All enrollments have valid academic years.');
  }
}

checkEnrollments();
