import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
CREATE OR REPLACE FUNCTION public.activate_academic_year(p_school_id TEXT, p_year_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- 1. Passer l'ancienne session ACTIVE en PAST
    UPDATE public.academic_years
    SET is_active = false,
        status = 'PAST'
    WHERE school_id = p_school_id AND status = 'ACTIVE' AND id != p_year_id;

    -- 2. Activer la session spécifiée
    UPDATE public.academic_years
    SET is_active = true,
        status = 'ACTIVE'
    WHERE id = p_year_id AND school_id = p_school_id;
END;
$$;
  `;
  console.log('Replacing public.activate_academic_year to use PAST...');
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  console.log('Result:', data, error);
}

run();
