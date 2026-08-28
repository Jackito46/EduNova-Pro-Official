import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSessions() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "SELECT json_agg(t) FROM (SELECT id, school_id, label, status, is_active FROM academic_years) t;" 
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  const sessions = data;
  if (!sessions) {
    console.log('No sessions found.');
    return;
  }

  console.log('--- Academic Sessions ---');
  console.table(sessions);

  // Check for schools with multiple active sessions
  const activePerSchool: Record<string, number> = {};
  sessions.forEach((s: any) => {
    if (s.is_active) {
      activePerSchool[s.school_id] = (activePerSchool[s.school_id] || 0) + 1;
    }
  });

  console.log('\n--- Active Sessions Per School ---');
  console.log(activePerSchool);

  const schoolsWithIssues = Object.entries(activePerSchool).filter(([_, count]) => count > 1);
  if (schoolsWithIssues.length > 0) {
    console.warn('WARNING: Some schools have multiple active sessions!', schoolsWithIssues);
  } else {
    console.log('OK: Each school has at most one active session.');
  }
}

checkSessions();
