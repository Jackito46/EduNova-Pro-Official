import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  console.log('Reading sql/transaction_exchange_rate_system.sql ...');
  const sql = fs.readFileSync('sql/transaction_exchange_rate_system.sql', 'utf8');

  console.log('Applying migration via exec_ddl...');
  const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: sql });
  if (error) {
    console.error('Error applying migration via exec_ddl:', error);
    process.exit(1);
  }
  console.log('Migration executed successfully via exec_ddl!');

  // Now execute the backfill function
  console.log('Executing backfill_payment_exchange_rate_journal()...');
  const { data: backfillData, error: backfillErr } = await supabase.rpc('backfill_payment_exchange_rate_journal');
  if (backfillErr) {
    console.error('Backfill error:', backfillErr);
    process.exit(1);
  }
  console.log('Backfill succeeded:', backfillData);

  // Check count in transaction_exchange_rate_journal
  const { data: countData, error: countErr } = await supabase.rpc('exec_sql', {
    sql_query: 'SELECT count(*) as total_logged FROM public.transaction_exchange_rate_journal;'
  });
  console.log('Journal count:', countData);
}

main().catch(console.error);
