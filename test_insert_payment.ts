import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const payload = {
    school_id: '3dd425c2-2e23-4e3c-a02a-c67ed85ca490',
    campus_id: '1ba06c27-3162-42fe-bd98-bc4a0dfc8361', // arbitrary from DB
    student_id: '2a4c0ffd-4fd3-44f2-a6dd-4037d28e4c1f', // Esther Destiné
    amount: 100,
    type: 'Stage / Frais: TEST',
    nature: 'Stage / Frais: TEST',
    fee_type: 'DIVERS',
    ad_hoc_campaign_id: '0f52e7c9-ca24-4cba-bd0b-08dada7a9281', // Wait, this doesn't exist, let's use null first or see if foreign key fails
    currency: 'HTG',
    payment_method: 'Cash',
    status: 'VALIDE',
    amount_htg_equivalent: 100,
    exchange_rate_applied: 1
  };

  const { data, error } = await supabase.from('payments').insert([payload]).select().single();
  console.log("Insert result with non-existent ad_hoc_campaign_id:", data, error);
}

run();
