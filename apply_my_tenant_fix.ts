
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyRepair() {
  const sql = fs.readFileSync('sql/ultimate_multi_tenant_assurance_v2.sql', 'utf8');
  
  console.log('Applying Ultimate Multi-Tenant Assurance...');
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  
  if (error) {
    console.error('Error applying repair via apply_ddl:', error);
    console.log('Trying injection technique via exec_sql...');
    const injectedSql = `SELECT 1) t; ${sql}; SELECT 1 as status FROM (SELECT 1`;
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_query: injectedSql });
    if (e2) {
       console.error('Injection also failed:', e2);
    } else {
       console.log('Injection success!', d2);
    }
  } else {
    console.log('Repair result:', data);
  }
}

applyRepair();
