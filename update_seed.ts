import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  let body = fs.readFileSync('current_seed.sql', 'utf-8');
  
  // Replace the beginning up to "IF v_school_type = 'UNIVERSITY' THEN"
  const newStart = `
DECLARE
    v_class_id UUID;
    v_academic_year_id UUID;
    v_school_type TEXT;
    v_session_config JSONB;
    v_session_mode TEXT;
    v_session_label TEXT;
    v_session_start DATE;
    v_session_end DATE;
    v_current_year INTEGER;
    v_current_month INTEGER;
BEGIN
    SELECT school_type INTO v_school_type FROM public.schools WHERE id = p_school_id;
    
    -- Load session config from global_settings
    SELECT value INTO v_session_config FROM public.global_settings WHERE key = 'session_config' LIMIT 1;
    
    IF v_session_config IS NOT NULL THEN
        v_session_mode := v_session_config->>'mode';
        v_session_label := v_session_config->>'label';
        
        IF v_session_config->>'start_date' IS NOT NULL AND v_session_config->>'start_date' != '' THEN
            v_session_start := (v_session_config->>'start_date')::DATE;
        END IF;
        
        IF v_session_config->>'end_date' IS NOT NULL AND v_session_config->>'end_date' != '' THEN
            v_session_end := (v_session_config->>'end_date')::DATE;
        END IF;
    END IF;
    
    -- Defaults if nothing is set or auto mode
    IF v_session_mode IS NULL OR v_session_mode = 'auto' THEN
        v_current_year := extract(year from current_date);
        v_current_month := extract(month from current_date);
        
        -- If we are before August, we consider it's the end of the previous academic year
        IF v_current_month < 8 THEN
            v_session_label := (v_current_year - 1)::TEXT || '-' || v_current_year::TEXT;
            v_session_start := MAKE_DATE(v_current_year - 1, 9, 1);
            v_session_end := MAKE_DATE(v_current_year, 6, 30);
        ELSE
            v_session_label := v_current_year::TEXT || '-' || (v_current_year + 1)::TEXT;
            v_session_start := MAKE_DATE(v_current_year, 9, 1);
            v_session_end := MAKE_DATE(v_current_year + 1, 6, 30);
        END IF;
    END IF;
    
    -- Fallbacks just in case
    IF v_session_label IS NULL OR v_session_label = '' THEN
        v_session_label := extract(year from current_date)::TEXT || '-' || (extract(year from current_date) + 1)::TEXT;
    END IF;
    IF v_session_start IS NULL THEN
        v_session_start := MAKE_DATE(extract(year from current_date)::INTEGER, 9, 1);
    END IF;
    IF v_session_end IS NULL THEN
        v_session_end := MAKE_DATE(extract(year from current_date)::INTEGER + 1, 6, 30);
    END IF;

    -- Création d'une année académique par défaut si aucune n'existe
    SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND status = 'ACTIVE' LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, start_date, end_date, status, is_active)
        VALUES (p_school_id, v_session_label, v_session_start, v_session_end, 'ACTIVE', true)
        ON CONFLICT (school_id, label) DO UPDATE SET is_active = EXCLUDED.is_active
        RETURNING id INTO v_academic_year_id;
        
        IF v_academic_year_id IS NULL THEN
            SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND label = v_session_label LIMIT 1;
        END IF;
    END IF;
    
    IF v_school_type = 'UNIVERSITY' THEN
`;

  // Find where to cut
  const cutIndex = body.indexOf("IF v_school_type = 'UNIVERSITY' THEN");
  if (cutIndex === -1) {
    console.error("Could not find cut index");
    return;
  }
  
  const newBody = newStart + body.substring(cutIndex + "IF v_school_type = 'UNIVERSITY' THEN".length);
  const fullSql = `CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ \n${newBody}\n $$;`;
  
  fs.writeFileSync('new_seed.sql', fullSql);

  console.log("Applying new DDL...");
  const { error } = await supabase.rpc('apply_ddl', { v_sql: fullSql });
  if (error) {
    console.error(error);
  } else {
    console.log("Successfully updated seed_school_data");
  }
}

run();
