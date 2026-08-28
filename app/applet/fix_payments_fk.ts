import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log('Deleting orphaned payments...');
  const { error: delErr } = await supabase.rpc('exec_sql', {
    sql_string: 'DELETE FROM public.payments p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = p.student_id);'
  });
  if (delErr) {
      console.error("Delete Error", delErr);
      return;
  }
  
  console.log('Adding constraints...');
  const { error: alt1 } = await supabase.rpc('exec_sql', {
    sql_string: 'ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;'
  });
  if (alt1) console.error("Alt1 Error", alt1);
  
  const { error: alt2 } = await supabase.rpc('exec_sql', {
    sql_string: 'ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;'
  });
  if (alt2) console.error("Alt2 Error", alt2);
  
  console.log('Done!');
}
run();
