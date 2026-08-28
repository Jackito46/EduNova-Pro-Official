import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    -- 1. Drop existing functions to avoid overload conflicts
    DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid);
    DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid);

    -- 2. Create the unified get_student_global_debt function
    CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID, p_exclude_year_id UUID DEFAULT NULL::UUID)
    RETURNS NUMERIC AS $$
    DECLARE
        v_total_due NUMERIC := 0;
        v_total_paid NUMERIC := 0;
        v_ad_hoc_due NUMERIC := 0;
    BEGIN
        -- A. Calculate academic dues (Tuition + Mandatory Misc fees)
        SELECT COALESCE(SUM(
            fp.tuition_fee + 
            CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) ELSE 0 END
        ), 0)
        INTO v_total_due
        FROM public.enrollments e
        JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
        JOIN public.academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = p_student_id
        -- Exclude specific year if requested
        AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
        -- Exclude active/future years from being counted as history/arrears if an exclude year is passed (arrears mode)
        -- Otherwise (absolute balance mode), count active and past years but not future years in preparation.
        AND (
            (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
            OR
            (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
        );

        -- B. Calculate ad_hoc dues
        SELECT COALESCE(SUM(c.amount), 0)
        INTO v_ad_hoc_due
        FROM public.student_ad_hoc_fees s
        JOIN public.ad_hoc_campaigns c ON s.campaign_id = c.id
        JOIN public.academic_years ay ON c.academic_year_id = ay.id
        WHERE s.student_id = p_student_id
        AND (p_exclude_year_id IS NULL OR c.academic_year_id IS DISTINCT FROM p_exclude_year_id)
        AND (
            (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
            OR
            (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
        );

        v_total_due := v_total_due + v_ad_hoc_due;

        -- C. Calculate payments made (Tuition + Mandatory Misc + Ad Hoc fees)
        SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
        INTO v_total_paid
        FROM public.payments p
        JOIN public.academic_years ay ON p.academic_year_id = ay.id
        WHERE p.student_id = p_student_id 
        AND p.fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC')
        AND (p_exclude_year_id IS NULL OR p.academic_year_id IS DISTINCT FROM p_exclude_year_id)
        AND (
            (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
            OR
            (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
        );

        RETURN GREATEST(v_total_due - v_total_paid, 0);
    END;
    $$ LANGUAGE plpgsql;
  `;

  console.log("Applying SQL DDL fix to Supabase via apply_ddl...");
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  if (error) {
    console.error("Failed to apply DDL SQL fix:", error);
  } else {
    console.log("DDL SQL Fix applied successfully:", data);
  }
}

run();
