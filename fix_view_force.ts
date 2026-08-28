import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const sql = `
CREATE VIEW public.v_schools_with_counts AS
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
  s.school_type,
  s.website,
  s.domain,
  (SELECT count(1) FROM public.students st WHERE st.school_id = s.id) AS student_count,
  (SELECT count(1) FROM public.profiles p WHERE p.school_id = s.id) AS staff_count
FROM public.schools s;

GRANT SELECT ON public.v_schools_with_counts TO authenticated;
GRANT SELECT ON public.v_schools_with_counts TO anon;
`;
  const { error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log("Create View Error:", error);

  const { error: err2 } = await supabase.rpc('apply_ddl', { v_sql: "NOTIFY pgrst, 'reload schema';" });
}
main();
