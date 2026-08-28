
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function init() {
  console.log("Initializing global_settings...");
  try {
    const { data: existing } = await supabase
      .from('global_settings')
      .select('*')
      .eq('key', 'system_status')
      .single();

    if (!existing) {
      console.log("Inserting system_status default value...");
      const { error } = await supabase
        .from('global_settings')
        .insert({
          key: 'system_status',
          value: { maintenance_mode: false }
        });
      
      if (error) {
        console.error("Error inserting:", error);
      } else {
        console.log("Successfully initialized system_status.");
      }
    } else {
      console.log("system_status already exists.");
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

init();
