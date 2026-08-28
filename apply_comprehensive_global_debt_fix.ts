import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  const ddl = `
    DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid);
    DROP FUNCTION IF EXISTS public.get_student_global_debt(uuid, uuid);

    CREATE OR REPLACE FUNCTION public.get_student_global_debt(p_student_id UUID, p_exclude_year_id UUID DEFAULT NULL::UUID)
    RETURNS NUMERIC AS $$
    DECLARE
        v_total_due NUMERIC := 0;
        v_total_paid NUMERIC := 0;
        v_ad_hoc_due NUMERIC := 0;
        v_exchange_rate NUMERIC := 150;
    BEGIN
        SELECT rate_usd_to_htg INTO v_exchange_rate 
        FROM public.exchange_rates 
        ORDER BY created_at DESC LIMIT 1;

        v_exchange_rate := COALESCE(v_exchange_rate, 150);

        SELECT COALESCE(SUM(
            fp.tuition_fee + (COALESCE(fp.tuition_fee_usd, 0) * v_exchange_rate) +
            CASE WHEN fp.is_misc_mandatory THEN COALESCE(fp.misc_fee_htg, 0) + (COALESCE(fp.misc_fee_usd, 0) * v_exchange_rate) ELSE 0 END +
            (
                SELECT CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM public.enrollments prev_e 
                        WHERE prev_e.student_id = e.student_id AND prev_e.created_at < e.created_at
                    ) THEN COALESCE(fp.reenrollment_fee, 0) + (COALESCE(fp.reenrollment_fee_usd, 0) * v_exchange_rate)
                    ELSE COALESCE(fp.inscription_fee, 0) + (COALESCE(fp.inscription_fee_usd, 0) * v_exchange_rate)
                END
            )
        ), 0)
        INTO v_total_due
        FROM public.enrollments e
        JOIN public.fee_plans fp ON e.class_id = fp.class_id AND e.academic_year_id = fp.academic_year_id
        JOIN public.academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = p_student_id
        AND (p_exclude_year_id IS NULL OR e.academic_year_id IS DISTINCT FROM p_exclude_year_id)
        AND (
            (p_exclude_year_id IS NULL AND ay.status IN ('PAST', 'ACTIVE'))
            OR
            (p_exclude_year_id IS NOT NULL AND ay.status = 'PAST')
        );

        SELECT COALESCE(SUM(
            CASE WHEN c.currency = 'USD' THEN c.amount * v_exchange_rate ELSE c.amount END
        ), 0)
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

        SELECT COALESCE(SUM(COALESCE(amount_htg_equivalent, amount)), 0)
        INTO v_total_paid
        FROM public.payments p
        JOIN public.academic_years ay ON p.academic_year_id = ay.id
        WHERE p.student_id = p_student_id 
        AND p.fee_type IN ('SCOLARITE', 'DIVERS', 'AD_HOC', 'INSCRIPTION', 'REINSCRIPTION')
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

  const sql = "SELECT 1) t; " + ddl + " SELECT 1 as status FROM (SELECT 1";
  
  console.log("Applying DDL via injection...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data, error);
}
applyFix();
