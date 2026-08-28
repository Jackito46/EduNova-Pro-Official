import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const query = `
    CREATE TABLE IF NOT EXISTS public.course_evaluations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
        class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
        academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
        teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
        term TEXT NOT NULL,
        name TEXT NOT NULL,
        weight_percentage NUMERIC,
        total_marks NUMERIC DEFAULT 100,
        date DATE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.student_subjects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
        student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
        class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
        academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'INSCRIT',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(student_id, subject_id, academic_year_id)
    );

    -- Enable RLS
    ALTER TABLE public.course_evaluations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

    -- Add policies
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'course_evaluations' AND policyname = 'Enable all operations for users based on school_id'
      ) THEN
        CREATE POLICY "Enable all operations for users based on school_id" 
        ON public.course_evaluations FOR ALL 
        USING (school_id IN (SELECT school_id FROM user_school));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'student_subjects' AND policyname = 'Enable all operations for users based on school_id'
      ) THEN
        CREATE POLICY "Enable all operations for users based on school_id" 
        ON public.student_subjects FOR ALL 
        USING (school_id IN (SELECT school_id FROM user_school));
      END IF;
    END
    $$;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
  
  if (error) {
    console.error('Error executing query:', error);
  } else {
    console.log('Tables course_evaluations and student_subjects created successfully.');
  }

  // Also we should modify Grades table to reference course_evaluations maybe? Or just keep term.
  // Wait, the existing grades table has: student_id, class_id, subject_id, exam_date, grade, max_grade, appreciation, etc.
  // We can add course_evaluation_id to grades
  const alterGrades = `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='course_evaluation_id') THEN
        ALTER TABLE public.grades ADD COLUMN course_evaluation_id UUID REFERENCES public.course_evaluations(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `;

  const { error: alterError } = await supabase.rpc('exec_sql', { sql_query: alterGrades });
  if (alterError) {
     console.error('Error adding course_evaluation_id to grades:', alterError);
  } else {
     console.log('Added course_evaluation_id to grades');
  }
}

run();
