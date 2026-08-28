import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: payments } = await supabase.from('payments').select('id, student_id, amount, status, cancel_reason, ad_hoc_campaign_id, created_at, nature').eq('status', 'ANNULE').ilike('cancel_reason', '%umdh%');
  console.log("Canceled payments with umdh in reason:", payments);
  
  if (payments && payments.length > 0) {
      for (const p of payments) {
          const { data: student } = await supabase.from('students').select('id, first_name, last_name, wallet_balance_htg').eq('id', p.student_id).single();
          console.log(`Student ${student?.first_name} ${student?.last_name}: wallet = ${student?.wallet_balance_htg}, payment amount = ${p.amount}, reason = ${p.cancel_reason}`);
      }
  }
}
check();
