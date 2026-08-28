import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.from('schools').select('*').limit(1);
  if (data && data.length > 0) {
     const school = data[0];
     // Try loading
     let settings = school.global_settings || {};
     console.log("Original GS type:", typeof school.global_settings);
     console.log("Original GS:", school.global_settings);
     
     // Update them
     const extraFields = { website: 'myweb.com', motto: 'hello' };
     const updatedSettings = { ...settings, ...extraFields };
     console.log("Payload to send:", updatedSettings);
     
     const { error: updErr } = await supabase.from('schools').update({ global_settings: updatedSettings }).eq('id', school.id);
     console.log("Update error:", updErr);
     
     // fetch again
     const { data: d2 } = await supabase.from('schools').select('*').eq('id', school.id).single();
     if (d2) {
       console.log("New GS type:", typeof d2.global_settings);
       console.log("New GS:", d2.global_settings);
     }
  } else {
     console.log("No data");
  }
}
run();
