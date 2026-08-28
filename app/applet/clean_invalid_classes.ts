import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
    DELETE FROM public.classes
    WHERE school_id IN (SELECT id FROM public.schools WHERE school_type = 'UNIVERSITY')
    AND level IN ('MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE');

    DELETE FROM public.classes
    WHERE school_id IN (SELECT id FROM public.schools WHERE school_type = 'PROFESSIONAL')
    AND level IN ('MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE', 'LICENCE', 'MASTER', 'DOCTORAT');

    DELETE FROM public.classes
    WHERE school_id IN (SELECT id FROM public.schools WHERE school_type = 'CLASSIC' OR school_type IS NULL)
    AND level IN ('LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME', 'DIPLÔME');
  `});
  console.log('Result:', data, error);
}
run();
