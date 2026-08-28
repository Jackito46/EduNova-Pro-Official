
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnyData() {
  const { data: assignments, count } = await supabase
    .from('staff_assignments')
    .select('*', { count: 'exact', head: false })
    .limit(10);

  console.log('Total assignments visible to anon:', count);
  console.log('Sample assignments:', assignments);

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .limit(5);
  console.log('Sample staff:', staff);
}

checkAnyData();
