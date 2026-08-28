import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
    DO $$ 
    BEGIN 
      -- 1. staff_assignments
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_assignments' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.staff_assignments ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id);
      END IF;

      -- 2. expenses
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.expenses ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id);
      END IF;

      -- 3. course_signatures
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_signatures' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.course_signatures ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id);
      END IF;
    END $$;
  `;

  console.log('Executing SQL to fix academic_year_id columns...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
