import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const sql = `
DROP VIEW IF EXISTS public.v_schools_with_counts CASCADE;

CREATE OR REPLACE VIEW public.v_schools_with_counts AS
SELECT 
    s.id,
    s.name,
    s.address,
    s.phone,
    s.email,
    s.logo_url,
    s.status,
    s.created_at,
    s.subscription_plan,
    s.subscription_end_date,
    s.is_protected,
    s.director_name,
    (SELECT count(1) FROM public.students st WHERE st.school_id = s.id) AS student_count,
    (SELECT count(1) FROM public.profiles p WHERE p.school_id = s.id) AS staff_count
FROM public.schools s;

GRANT SELECT ON public.v_schools_with_counts TO authenticated;
  `;
  
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  if (error) {
     console.error("apply_ddl error, trying exec_sql");
     const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_query: `SELECT 1) t; ${sql}; SELECT 1 as status FROM (SELECT 1` });
     console.log(d2, e2);
  } else {
    console.log(data);
  }
}

run();
