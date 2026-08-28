import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    WITH t AS (
      INSERT INTO payments (
        school_id, campus_id, student_id, amount, type, nature, fee_type, ad_hoc_campaign_id, currency, payment_method, status, amount_htg_equivalent, exchange_rate_applied
      ) VALUES (
        '3dd425c2-2e23-4e3c-a02a-c67ed85ca490',
        '1ba06c27-3162-42fe-bd98-bc4a0dfc8361',
        '2a4c0ffd-4fd3-44f2-a6dd-4037d28e4c1f',
        100,
        'Stage / Frais: TEST',
        'Stage / Frais: TEST',
        'DIVERS',
        NULL,
        'HTG',
        'Cash',
        'VALIDE',
        100,
        1
      ) RETURNING *
    )
    SELECT * FROM t
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log("CTE insert result:", data, error);
}

run();
