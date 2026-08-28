import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Try finding service role key
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(process.env.VITE_SUPABASE_URL, serviceRoleKey);
const schoolId = 'a89520ab-3894-49d4-86d8-1421e3012f58';

async function main() {
  console.log("Checking credentials...", serviceRoleKey === process.env.VITE_SUPABASE_ANON_KEY ? 'ANON' : 'SERVICE_ROLE');
  
  // To avoid RLS issues, we'll fetch ID of payments to delete, then call a known function, 
  // or use the service role key which bypasses RLS.
  
  const { data: payments, error: fetchErr } = await supabase
    .from('payments')
    .select('id')
    .eq('school_id', schoolId)
    .eq('fee_type', 'SCOLARITE');
    
  if (fetchErr) {
    console.error("Fetch err:", fetchErr);
    return;
  }
  
  console.log(`Found ${payments.length} SCOLARITE payments to delete`);
  
  let deleted = 0;
  for (const p of payments) {
    const { error } = await supabase.from('payments').delete().eq('id', p.id);
    if (!error) deleted++;
    else console.error("Del err:", error.message);
  }
  console.log(`Successfully deleted ${deleted} payments.`);
}

main();
