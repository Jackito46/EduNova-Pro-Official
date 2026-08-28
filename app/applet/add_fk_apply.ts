import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const sql = `
DO $$
BEGIN
   -- Verify deletion before altering (just in case they got created since last step)
   DELETE FROM public.payments p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);

   ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
   ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;
END $$;
  `;
  const {data, error} = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log("data:", data, "error:", error);
}
run();
