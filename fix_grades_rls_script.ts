import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixGradesRLS() {
  const sql = `
    -- Enable RLS on grades
    ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies
    DO $$ 
    DECLARE 
        r RECORD;
    BEGIN 
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'grades' AND schemaname = 'public') 
        LOOP 
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.grades'; 
        END LOOP; 
    END $$;

    -- Create new policies using get_my_school_id()
    CREATE POLICY "Grades read access" ON public.grades
        FOR SELECT USING (school_id = public.get_my_school_id() OR public.is_super_admin());

    CREATE POLICY "Grades insert access" ON public.grades
        FOR INSERT WITH CHECK (school_id = public.get_my_school_id() OR public.is_super_admin());

    CREATE POLICY "Grades update access" ON public.grades
        FOR UPDATE USING (school_id = public.get_my_school_id() OR public.is_super_admin())
        WITH CHECK (school_id = public.get_my_school_id() OR public.is_super_admin());

    CREATE POLICY "Grades delete access" ON public.grades
        FOR DELETE USING (school_id = public.get_my_school_id() OR public.is_super_admin());

    -- Reload schema cache
    NOTIFY pgrst, 'reload schema';
  `;

  // We can't execute raw SQL directly from the client without an RPC.
  // Let's see if there's an RPC to execute SQL.
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  console.log("Result:", data, error);
}

fixGradesRLS();
