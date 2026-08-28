import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function main() {
  const { data: schools } = await supabase.from('schools').select('id, name, school_type').order('created_at', { ascending: false }).limit(2);
  console.log("Recent Schools:", schools);

  if (schools && schools.length > 0) {
    const schoolId = schools[0].id;
    const { data: classes } = await supabase.from('classes').select('name, level').eq('school_id', schoolId).limit(100);
    console.log("Classes found for", schools[0].name, ":", classes?.length);
    const proClasses = classes?.filter(c => c.level === 'DIPLOME' || c.level === 'CERTIFICAT') || [];
    console.log("Pro classes:", proClasses.length);
    console.dir(proClasses.slice(0, 15), {depth: null});
  }
}
main();
