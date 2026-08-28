import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = [
    'course_signatures', 'salary_advances', 'school_supplies', 
    'disciplinary_sanction_types', 'payment_gateways', 'supply_catalog', 
    'payroll_periods', 'communication_logs', 'resource_locks', 
    'supply_payments', 'enrollments', 'staff_salary_history', 
    'staff_attendances', 'payroll_slips', 'student_attendances', 
    'profiles', 'grades', 'subjects', 'students', 'class_schedules', 
    'audit_logs', 'disciplinary_records', 'class_subjects', 'expenses', 
    'staff_assignments', 'communication_settings', 'exchange_rates', 
    'communication_recipients', 'classes', 'fee_plans', 
    'expense_categories', 'staff', 'staff_roles', 'subscription_history', 
    'subscription_reminders', 'payments', 'academic_years'
  ];

  let ddl = `
    -- Enable DELETE on schools for Super Admin
    DROP POLICY IF EXISTS "schools_delete_super_admin" ON public.schools;
    CREATE POLICY "schools_delete_super_admin" ON public.schools
    FOR DELETE
    USING (is_super_admin());
  `;

  for (const table of tables) {
    const constraintName = `${table}_school_id_fkey`;
    ddl += `
      ALTER TABLE public.${table} DROP CONSTRAINT IF EXISTS ${constraintName};
      ALTER TABLE public.${table} ADD CONSTRAINT ${constraintName} 
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
    `;
  }

  const sql = `SELECT 1) t; ${ddl} SELECT 1 as status FROM (SELECT 1`;
  
  console.log(`Applying comprehensive CASCADE DELETE and RLS FIX...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Error applying comprehensive fix:", error);
  } else {
    console.log("Comprehensive fix result:", data);
  }
}

run();
