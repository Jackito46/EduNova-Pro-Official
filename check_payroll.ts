import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const schoolId = 'a0ed9087-0554-40ae-ac26-86599a183b16';
  
  const { data: staff, error: staffErr } = await supabase.rpc('exec_sql', { sql_query: "SELECT id, first_name, last_name, pay_type, amount FROM staff WHERE school_id = '" + schoolId + "'" });
  if (staffErr) console.error("Staff Err:", staffErr);
  
  const { data: assignments, error: assErr } = await supabase.rpc('exec_sql', { sql_query: "SELECT staff_id, duration_hours, hourly_rate FROM staff_assignments WHERE school_id = '" + schoolId + "'" });
  if (assErr) console.error("Assignments Err:", assErr);
  
  const { data: expenses, error: expErr } = await supabase.rpc('exec_sql', { sql_query: "SELECT * FROM expenses WHERE school_id = '" + schoolId + "'" });
  console.log("Expenses:", expenses);
  
  let totalPayroll = 0;
  if (staff && Array.isArray(staff)) {
    staff.forEach((s: any) => {
      const val = Number(s.amount) || 0;
      const fixedSalary = s.pay_type === 'Mensuel' ? val : (s.pay_type === 'Fixe' ? val : 0);
      
      const memberAssignments = assignments?.filter((a: any) => a.staff_id === s.id) || [];
      const teachingSalary = memberAssignments.reduce((sum: number, a: any) => sum + (Number(a.duration_hours) * Number(a.hourly_rate || 0) * 4), 0);
      
      console.log(`Staff ${s.name}: pay_type='${s.pay_type}', amount=${s.amount}, fixedSalary computed=${fixedSalary}, teachingSalary computed=${teachingSalary}, total for this staff=${fixedSalary + teachingSalary}`);
      totalPayroll += fixedSalary + teachingSalary;
    });
  } else {
    console.log("Staff is not an array:", staff);
  }
  
  console.log('Total Payroll Computed:', totalPayroll);
}
run().catch(console.error);
