import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://iymzthjkucvhyjnxpslg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE');

async function main() {
  const { data: schools } = await supabase.from('schools').select('id, name, school_type').limit(10);
  console.log("Schools:", schools);

  const { data: classes } = await supabase.from('classes').select('name, level').limit(100);
  console.log("Global classes length:", classes?.length);
  const proClasses = classes?.filter(c => c.level === 'DIPLOME' || c.level === 'CERTIFICAT') || [];
  console.log("Global pro classes length:", proClasses.length);
}
main();
