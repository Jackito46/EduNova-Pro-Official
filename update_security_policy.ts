import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSecurityPolicy() {
  console.log('Updating security policy in global_settings...');
  
  const newPolicy = {
    max_failed_attempts: 3,
    lockout_duration_minutes: 10,
    session_timeout_minutes: 10
  };

  const { data: existing, error: fetchError } = await supabase
    .from('global_settings')
    .select('*')
    .eq('key', 'security_policy')
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching settings:', fetchError);
    return;
  }

  if (existing) {
    const updatedValue = { ...existing.value, ...newPolicy };
    const { error } = await supabase
      .from('global_settings')
      .update({ value: updatedValue })
      .eq('key', 'security_policy');
    
    if (error) console.error('Error updating policy:', error);
    else console.log('Security policy updated successfully.');
  } else {
    const { error } = await supabase
      .from('global_settings')
      .insert([{ key: 'security_policy', value: newPolicy }]);
    
    if (error) console.error('Error inserting policy:', error);
    else console.log('Security policy created successfully.');
  }
}

updateSecurityPolicy();
