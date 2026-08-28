import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const email = 'vilinfo2014@gmail.com';
  console.log(`Verifying user: ${email}`);

  // 1. Get Profile
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*, schools(*)')
    .eq('email', email)
    .single();

  if (pError) {
    console.error('Error fetching profile:', pError);
    return;
  }
  console.log('Profile found:', JSON.stringify(profile, null, 2));

  const schoolId = profile.school_id;
  if (!schoolId) {
    console.error('User has no school_id');
    return;
  }

  // 2. Check Academic Years
  const { data: ay, error: ayError } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId);
  console.log(`Academic Years: ${ay?.length || 0}`, ayError || '');

  // 3. Check Classes
  const { data: classes, error: cError } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId);
  console.log(`Classes: ${classes?.length || 0}`, cError || '');

  // 4. Check Subjects
  const { data: subjects, error: sError } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId);
  console.log(`Subjects: ${subjects?.length || 0}`, sError || '');
}

verify();
