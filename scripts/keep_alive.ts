import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to directory path for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function keepSupabaseAlive() {
  console.log(`[${new Date().toISOString()}] Initiating Keep-Alive ping to Supabase...`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL or SUPABASE_KEY missing in .env file.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const startTime = Date.now();
    
    // A simple, lightweight query to wake up or keep the database awake
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Keep-Alive ping successful! (Took ${duration}ms)`);
    console.log(`Note: Configure cron-job.org or GitHub Actions to run this API endpoint: '/api/keep-alive'`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Keep-Alive ping failed:`, error.message || error);
    process.exit(1);
  }
}

keepSupabaseAlive();
