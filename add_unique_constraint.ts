import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addUniqueConstraint() {
  const { error } = await supabase.rpc('exec_sql', { 
    sql_string: `
      ALTER TABLE public.course_signatures 
      ADD CONSTRAINT unique_session_signature 
      UNIQUE (staff_id, class_id, subject_id, date, start_time, end_time);
    ` 
  });

  if (error) {
    console.error('Error adding constraint:', error);
  } else {
    console.log('Unique constraint added successfully.');
  }
}

addUniqueConstraint();
