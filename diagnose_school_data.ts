
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssignments() {
  const schoolId = 'a0ed9087-0554-40ae-ac26-86599a183b16';
  
  // 1. Check assignments directly for this school
  const { data: assignments, error: assError, count } = await supabase
    .from('staff_assignments')
    .select('*, staff!inner(id, full_name, school_id)', { count: 'exact' })
    .eq('school_id', schoolId);

  if (assError) {
    console.error('Error fetching assignments:', assError);
  } else {
    console.log(`Total assignments for school ${schoolId}: ${count}`);
    if (assignments && assignments.length > 0) {
        console.log('First assignment snapshot:', {
            id: assignments[0].id,
            staff_id: assignments[0].staff_id,
            academic_year_id: assignments[0].academic_year_id,
            school_id: assignments[0].school_id,
            staff_name: assignments[0].staff?.full_name
        });
    }
  }

  // 2. Check academic years for this school
  const { data: years } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId);

  console.log('Academic years for school:', years?.map(y => ({ id: y.id, name: y.name, status: y.status, is_active: y.is_active })));

  // 3. Check if there are assignments with NULL school_id that might belong to this school's staff
  // We'll look for staff belonging to this school first
  const { data: schoolStaff } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('school_id', schoolId);
  
  const staffIds = schoolStaff?.map(s => s.id) || [];
  console.log(`Found ${staffIds.length} staff members for the school.`);

  if (staffIds.length > 0) {
      const { data: orphanAssignments } = await supabase
        .from('staff_assignments')
        .select('id, staff_id, school_id, academic_year_id')
        .in('staff_id', staffIds)
        .is('school_id', null);
      
      console.log(`Found ${orphanAssignments?.length || 0} assignments with NULL school_id for this school's staff.`);
  }
}

checkAssignments();
