
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data, error } = await supabase.from('communication_logs').select('*').limit(1);
  if (error) {
    console.error('Error fetching communication_logs:', error);
  } else {
    console.log('Columns in communication_logs:', data.length > 0 ? Object.keys(data[0]) : 'No data to check columns');
  }
  
  const { error: err2 } = await supabase.from('communication_logs').select('sender_name').limit(1);
  console.log('sender_name exists:', !err2 || err2.code !== 'PGRST204', err2?.code, err2?.message);
}

checkColumns();
