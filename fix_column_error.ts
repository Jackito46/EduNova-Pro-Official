import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_signatures' AND column_name = 'academic_year_id') THEN
            ALTER TABLE public.course_signatures ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_course_signatures_academic_year ON public.course_signatures(academic_year_id);
        END IF;
    END $$;
  `;
  
  console.log('Executing SQL to add academic_year_id to course_signatures...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}
run();
