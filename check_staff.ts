import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!
);

async function findStaff() {
  const schoolId = 'a0ed9087-0554-40ae-ac26-86599a183b16';
  
  const { data: staff } = await supabase.from('staff').select('*').eq('school_id', schoolId);
  const { data: assignments } = await supabase.from('staff_assignments').select('*').eq('school_id', schoolId);
  
  console.log(`Found ${staff?.length} staff members.`);
  
  let totalPayroll = 0;
  staff?.forEach(s => {
    const val = Number(s.amount) || 0;
    const fixedSalary = s.pay_type === 'Fixe' ? val : 0;
    
    const memberAssignments = assignments?.filter((a: any) => a.staff_id === s.id) || [];
    const teachingSalary = memberAssignments.reduce((sum: number, a: any) => sum + (Number(a.duration_hours) * Number(a.hourly_rate || 0) * 4), 0);
    
    console.log(`Staff ${s.name}: pay_type=${s.pay_type}, amount=${s.amount}, fixedSalary=${fixedSalary}, teachingSalary=${teachingSalary}, total=${fixedSalary + teachingSalary}`);
    totalPayroll += fixedSalary + teachingSalary;
  });
  
  console.log('Total Payroll Computed:', totalPayroll);
}

findStaff();
