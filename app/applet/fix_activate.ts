import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
CREATE OR REPLACE FUNCTION public.activate_academic_year(p_school_id text, p_year_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_school_type text;
BEGIN
    SELECT school_type INTO v_school_type FROM public.schools WHERE id = p_school_id;

    IF v_school_type IN ('UNIVERSITY', 'PROFESSIONAL') THEN
        -- Activer la session spécifiée sans désactiver les autres
        UPDATE public.academic_years
        SET is_active = true,
            status = 'ACTIVE'
        WHERE id = p_year_id AND school_id = p_school_id;
    ELSE
        -- 1. Passer l'ancienne session ACTIVE en PAST (ou CLOTUREE)
        UPDATE public.academic_years
        SET is_active = false,
            status = 'PAST'
        WHERE school_id = p_school_id AND status = 'ACTIVE' AND id != p_year_id;

        -- 2. Activer la session spécifiée
        UPDATE public.academic_years
        SET is_active = true,
            status = 'ACTIVE'
        WHERE id = p_year_id AND school_id = p_school_id;
    END IF;
END;
$function$;
  ` });
  console.log('Result:', data, error);
}
run();
