import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
CREATE OR REPLACE FUNCTION public.search_students_accent_insensitive(p_school_id uuid, p_query text, p_limit integer DEFAULT 15)
 RETURNS TABLE(id uuid, first_name text, last_name text, class_name text, class_id uuid, discount_amount numeric, birth_date date, birth_place text, gender text, reference_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_query TEXT;
BEGIN
    v_query := public.unaccent(trim(p_query));
    RETURN QUERY
    SELECT 
        s.id,
        s.first_name,
        s.last_name,
        c.name as class_name,
        s.class_id,
        s.discount_amount,
        s.dob as birth_date,
        s.pob as birth_place,
        s.gender,
        s.reference_number
    FROM public.students s
    LEFT JOIN public.classes c ON s.class_id = c.id
    WHERE s.school_id = p_school_id
    AND (
        public.unaccent(s.first_name) ILIKE '%' || v_query || '%'
        OR 
        public.unaccent(s.last_name) ILIKE '%' || v_query || '%'
        OR
        public.unaccent(s.first_name || ' ' || s.last_name) ILIKE '%' || v_query || '%'
        OR
        s.id::text ILIKE '%' || p_query || '%'
        OR
        s.reference_number ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit;
END;
$function$;
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log(data, error);
}
run();
