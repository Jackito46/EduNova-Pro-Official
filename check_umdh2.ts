import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: camps } = await supabase.from('ad_hoc_campaigns').select('*').ilike('name', '%umdh%');
  console.log("UMDH Camps:", camps);
  
  if (camps && camps.length > 0) {
      for (const camp of camps) {
          const { data: payments } = await supabase.from('payments').select('*').eq('ad_hoc_campaign_id', camp.id);
          console.log(`Payments for ${camp.name}:`, payments?.length);
          if (payments) {
              for (const p of payments) {
                  const { data: student } = await supabase.from('students').select('id, first_name, last_name, wallet_balance_htg').eq('id', p.student_id).single();
                  console.log(`Student ${student?.first_name} ${student?.last_name}: wallet = ${student?.wallet_balance_htg}, payment status = ${p.status}, payment cancel_reason = ${p.cancel_reason}`);
              }
          }
      }
  } else {
      console.log("No UMDH camps found. Searching payments directly.");
      const { data: payments } = await supabase.from('payments').select('*').ilike('nature', '%umdh%');
      console.log("UMDH Payments directly:", payments);
  }
}
check();
