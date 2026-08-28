import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyFix() {
  const sql = fs.readFileSync('./sql/rls_comprehensive_fix.sql', 'utf8');
  
  // Split SQL by semicolon and run each statement
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 50)}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: statement });
    if (error) {
      console.error('Error executing statement:', error);
    } else {
      console.log('Success');
    }
  }
}

applyFix();
