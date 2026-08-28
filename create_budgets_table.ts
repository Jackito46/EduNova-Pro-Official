import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env file manually just in case
if (fs.existsSync(".env")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error("VITE_SUPABASE_URL is missing!");
  process.exit(1);
}

// We MUST use the service role key to bypass permission checks and create tables
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

async function run() {
  console.log("Using URL:", supabaseUrl);
  console.log("Service Key is present:", !!supabaseServiceKey);
  
  const ddl = `
  DROP TABLE IF EXISTS public.budgets CASCADE;

  CREATE TABLE public.budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
      academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
      campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      planned_amount NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Create Unique Index supporting NULL values for global budget vs campus budget
  CREATE UNIQUE INDEX IF NOT EXISTS budgets_school_year_campus_category_idx ON public.budgets (
      school_id, 
      academic_year_id, 
      category, 
      (COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

  -- Enable Row Level Security
  ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

  -- Create Tenant Isolation Policies (same as expenses and others)
  DROP POLICY IF EXISTS isolation_budgets_v2 ON public.budgets;
  CREATE POLICY isolation_budgets_v2 ON public.budgets
      FOR ALL
      TO public
      USING ((school_id = get_my_school_id()) OR is_super_admin())
      WITH CHECK ((school_id = get_my_school_id()) OR is_super_admin());

  DROP POLICY IF EXISTS "Standard Isolation" ON public.budgets;
  CREATE POLICY "Standard Isolation" ON public.budgets
      FOR ALL
      TO public
      USING ((school_id = get_my_school_id()) OR is_super_admin())
      WITH CHECK ((school_id = get_my_school_id()) OR is_super_admin());
  `;

  console.log("Applying DDL...");
  // Let's call exec_ddl function which runs as security definer
  const { data, error } = await supabase.rpc("exec_ddl", { ddl_query: ddl });
  
  if (error) {
    console.error("Error applying DDL:", error);
  } else {
    console.log("DDL successfully applied! Result:", data);
    // Reload PostgREST schema so new column is visible immediately
    await supabase.rpc('exec_ddl', { ddl_query: "NOTIFY pgrst, 'reload schema';" });
  }
}

run();
