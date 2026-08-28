
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssignments() {
  const schoolId = 'a0ed9087-0554-40ae-ac26-86599a183b16';
  
  const { data, error, count } = await supabase
    .from('staff_assignments')
    .select('id, staff_id, academic_year_id, school_id', { count: 'exact' })
    .eq('school_id', schoolId);

  if (error) {
    console.error('Error fetching assignments:', error);
    return;
  }

  console.log(`Total assignments for school ${schoolId}: ${count}`);
  console.log('Sample data:', data?.slice(0, 5));

  const { data: years } = await supabase
    .from('academic_years')
    .select('id, name, status, is_active')
    .eq('school_id', schoolId);

  console.log('Academic years for school:', years);
}

checkAssignments();
