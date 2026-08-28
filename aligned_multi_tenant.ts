
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql(sql: string) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error(`Error executing SQL: ${sql.substring(0, 50)}...`, error);
    return false;
  }
  console.log(`Success: ${sql.substring(0, 50)}...`, data);
  return true;
}

async function start() {
  console.log("Starting Multi-Tenant Alignment...");

  // 1. Robust get_my_school_id
  await runSql(`
    CREATE OR REPLACE FUNCTION public.get_my_school_id()
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN (
        SELECT school_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      );
    END;
    $func$
  `);

  // 2. Identify all tables with school_id to unify them
  const tables = [
    'academic_years', 'classes', 'subjects', 'students', 'fee_plans', 
    'expense_categories', 'expenses', 'payments', 'staff', 'enrollments', 
    'staff_assignments', 'staff_attendances', 'school_details', 'payroll_periods', 
    'payroll_slips', 'salary_advances', 'school_supplies', 'supply_payments', 
    'disciplinary_records', 'course_signatures', 'staff_salary_history', 
    'communication_logs', 'communication_settings', 'student_attendances', 
    'class_schedules', 'exchange_rates', 'audit_logs'
  ];

  const main_school_id = 'a0ed9087-0554-40ae-ac26-86599a183b16';

  for (const table of tables) {
    console.log(`Processing table: ${table}`);
    
    // Check if school_id exists and its type
    // If it's text, convert it
    await runSql(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'school_id') THEN
          -- Convert to UUID if it's text
          IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'school_id') IN ('text', 'character varying', 'varchar') THEN
            ALTER TABLE public.${table} ALTER COLUMN school_id TYPE UUID USING CASE WHEN school_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN school_id::UUID ELSE '${main_school_id}'::UUID END;
          END IF;
          
          -- Ensure NOT NULL (except audit_logs)
          IF '${table}' != 'audit_logs' THEN
            UPDATE public.${table} SET school_id = '${main_school_id}' WHERE school_id IS NULL;
            ALTER TABLE public.${table} ALTER COLUMN school_id SET NOT NULL;
          END IF;
        END IF;
      END $$
    `);

    // Standardize RLS
    await runSql(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    await runSql(`DROP POLICY IF EXISTS "Standard Isolation" ON public.${table}`);
    await runSql(`DROP POLICY IF EXISTS "Isolation ${table}" ON public.${table}`);
    
    if (table === 'audit_logs') {
      await runSql(`
        CREATE POLICY "Standard Isolation" ON public.audit_logs
        FOR ALL
        USING (
            (school_id = public.get_my_school_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'))
            OR (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
        )
      `);
    } else {
      await runSql(`
        CREATE POLICY "Standard Isolation" ON public.${table}
        FOR ALL
        USING (
            school_id = public.get_my_school_id()
            OR (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
        )
        WITH CHECK (
            school_id = public.get_my_school_id()
            OR (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
        )
      `);
    }
  }

  console.log("Finished Multi-Tenant Alignment.");
}

start();
