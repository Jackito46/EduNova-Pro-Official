const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://iymzthjkucvhyjnxpslg.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE");

async function run() {
  const sql = `
  CREATE OR REPLACE FUNCTION clean_school_test_data(p_school_id UUID)
  RETURNS void AS $$
  BEGIN
    -- Ignore errors for individual statements just in case table not found
    BEGIN
      DELETE FROM public.applications WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
      DELETE FROM public.payments WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.expenses WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
      DELETE FROM public.attendance_records WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.grades WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.report_cards WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.supply_payments WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.school_supplies WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.student_ad_hoc_fees WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
      DELETE FROM public.enrollments WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.students WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.communication_logs WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.message_recipients WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      DELETE FROM public.messages WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
      DELETE FROM public.receipt_records WHERE school_id = p_school_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  const { data, error } = await supabase.rpc("apply_ddl", { v_sql: sql });
  console.log("Creation of RPC", error ? "FAILED" : "SUCCESS", error || data);
}

run();
