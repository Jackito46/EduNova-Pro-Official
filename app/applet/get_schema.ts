import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: plans, error: e1 } = await supabase.from('fee_plans').select('*').limit(1);
  console.log("fee_plans:", plans?.[0] ? Object.keys(plans[0]) : e1);
  
  const { data: supplies, error: e2 } = await supabase.from('school_supplies').select('*').limit(1);
  console.log("supplies:", supplies?.[0] ? Object.keys(supplies[0]) : e2);
  
  const { data: classes, error: e3 } = await supabase.from('classes').select('*').limit(1);
  console.log("classes:", classes?.[0] ? Object.keys(classes[0]) : e3);
  
  const { data: subjects, error: e4 } = await supabase.from('subjects').select('*').limit(1);
  console.log("subjects:", subjects?.[0] ? Object.keys(subjects[0]) : e4);
}
check();
