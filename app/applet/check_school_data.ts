import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('email', 'jackito46@gmail.com').single();
  const { data: school } = await supabase.from('schools').select('id, name, school_type').eq('id', profile.school_id).single();
  console.log('School Info:', school);
  
  const { data: classes } = await supabase.from('classes').select('name, stage').eq('school_id', profile.school_id);
  console.log('Classes count:', classes?.length);
  const classNames = classes?.map(c => c.name).join(', ');
  console.log('Classes:', classNames);
}
run().catch(console.error);
