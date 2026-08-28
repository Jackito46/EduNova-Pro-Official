import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'supply_catalog_academic_year_id_fkey' AND table_name = 'supply_catalog') THEN
    ALTER TABLE supply_catalog DROP CONSTRAINT supply_catalog_academic_year_id_fkey;
  END IF;

  -- Add new constraint with ON DELETE CASCADE
  ALTER TABLE supply_catalog
  ADD CONSTRAINT supply_catalog_academic_year_id_fkey
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
END $$;
`;

async function main() {
  console.log("Adding ON DELETE CASCADE to supply_catalog.academic_year_id...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Failed:", error.message);
  } else {
    console.log("Success! Constraint updated.");
  }
}

main();
