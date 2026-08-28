import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyAllFixes() {
  const ddl = `
    -- 1. ADD MISSING CATEGORY COLUMN
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'category') THEN
        ALTER TABLE public.subjects ADD COLUMN category TEXT;
      END IF;
    END $$;

    -- 2. ENHANCED SEED FUNCTION
    CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $seed$
    DECLARE
        v_ay_id UUID;
    BEGIN
        INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
        VALUES (p_school_id, '2026-2027', true, 'ACTIVE', '2026-09-01', '2027-06-30')
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_ay_id;

        IF v_ay_id IS NULL THEN
            SELECT id INTO v_ay_id FROM public.academic_years 
            WHERE school_id = p_school_id AND is_active = true LIMIT 1;
        END IF;

        UPDATE public.schools
        SET global_settings = jsonb_build_object(
            'currency', 'HTG',
            'school_name', name,
            'academic_year_id', v_ay_id
        )
        WHERE id = p_school_id;

        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Petite Section', 'MATERNELLE'),
            (p_school_id, 'Moyenne Section', 'MATERNELLE'),
            (p_school_id, 'Grande Section', 'MATERNELLE'),
            (p_school_id, '1ère AF', 'FONDAMENTALE'),
            (p_school_id, '2ème AF', 'FONDAMENTALE'),
            (p_school_id, '3ème AF', 'FONDAMENTALE'),
            (p_school_id, '4ème AF', 'FONDAMENTALE'),
            (p_school_id, '5ème AF', 'FONDAMENTALE'),
            (p_school_id, '6ème AF', 'FONDAMENTALE'),
            (p_school_id, '7ème AF', 'FONDAMENTALE'),
            (p_school_id, '8ème AF', 'FONDAMENTALE'),
            (p_school_id, '9ème AF', 'FONDAMENTALE'),
            (p_school_id, 'NS1', 'SECONDAIRE'),
            (p_school_id, 'NS2', 'SECONDAIRE'),
            (p_school_id, 'NS3', 'SECONDAIRE'),
            (p_school_id, 'NS4', 'SECONDAIRE')
        ON CONFLICT (school_id, name) DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category)
        VALUES 
            (p_school_id, 'Français', 'FRA', 'LANGUAGES'),
            (p_school_id, 'Mathématiques', 'MAT', 'SCIENCE'),
            (p_school_id, 'Créole', 'CRE', 'LANGUAGES'),
            (p_school_id, 'Anglais', 'ANG', 'LANGUAGES'),
            (p_school_id, 'Sciences Sociales', 'SS', 'GENERAL'),
            (p_school_id, 'Sciences Physiques', 'SP', 'SCIENCE'),
            (p_school_id, 'Biologie', 'BIO', 'SCIENCE'),
            (p_school_id, 'Chimie', 'CHI', 'SCIENCE'),
            (p_school_id, 'Informatique', 'INF', 'TECH')
        ON CONFLICT (school_id, code) DO NOTHING;
    END; $seed$;

    -- 3. TRIGGER SEEDING FOR THE PROBLEM SCHOOL
    SELECT public.seed_school_data('21c54d15-5971-4a88-8181-2cc035b8b0ca');
  `;

  const sql = `SELECT 1) t; ${ddl} SELECT 1 as status FROM (SELECT 1`;
  
  console.log(`Applying all repairs and seeding via injection...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data, error);
}
applyAllFixes();
