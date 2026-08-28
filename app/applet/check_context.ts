import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: userProfile } = await supabase.from('profiles').select('*').eq('email', 'jackito46@gmail.com').single();
  if (!userProfile) {
    console.error('User not found');
    return;
  }
  const schoolId = userProfile.school_id;
  console.log('School ID:', schoolId);

  // Active Year
  const { data: activeYears } = await supabase.from('academic_years').select('*').eq('school_id', schoolId).in('status', ['ACTIVE']);
  console.log('Active Years:', activeYears);

  // Level 1 Classes
  const { data: classes } = await supabase.from('classes').select('*').eq('school_id', schoolId).like('name', '% I');
  console.log('Level 1 Classes:', classes);

  // Fee Plans
  const { data: feePlans } = await supabase.from('fee_plans').select('*').eq('school_id', schoolId).eq('academic_year_id', activeYears?.[0]?.id);
  console.log('Fee Plans:', feePlans);
}

main().catch(console.error);
