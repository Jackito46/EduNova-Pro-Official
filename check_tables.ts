import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName: string) {
  console.log(`\n--- Table: ${tableName} ---`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log(`Columns: ${columns.join(', ')}`);
    if (columns.includes('school_id')) {
      console.log(`✅ Multi-tenant ready (has school_id)`);
    } else {
      console.log(`❌ NOT Multi-tenant ready (missing school_id)`);
    }
  } else {
    console.log(`Table is empty. Attempting to get columns via a dummy insert...`);
    const { error: insertError } = await supabase.from(tableName).insert({ dummy_column_that_does_not_exist: 1 }).select();
    if (insertError) {
      // Sometimes the error message contains the valid columns or we can infer it
      console.log(`Insert error: ${insertError.message}`);
    }
  }
}

async function run() {
  await checkTable('global_settings');
  await checkTable('session_policies');
  await checkTable('supply_payments');
  await checkTable('academic_years');
  await checkTable('active_sessions');
}

run();
