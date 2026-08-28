import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data, error } = await supabase.from('staff').select('role').limit(100);
  if (error) {
    console.error('Error:', error);
    return;
  }
  const roles = new Set(data.map(s => s.role));
  console.log('Roles found in staff table:', Array.from(roles));
}

checkRoles();
