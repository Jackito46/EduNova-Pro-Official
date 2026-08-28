import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const sql = `
DO $$
BEGIN
    DELETE FROM public.school_supplies p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
    DELETE FROM public.grades p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
    DELETE FROM public.enrollments p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
    DELETE FROM public.student_attendances p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
    DELETE FROM public.disciplinary_records p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
    DELETE FROM public.student_ad_hoc_fees p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);
END $$;`;

  const {data, error} = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log('Result:', data, error);
}
run();
