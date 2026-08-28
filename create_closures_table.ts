import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql1 = `
  CREATE TABLE IF NOT EXISTS public.daily_cash_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    campus_id UUID,
    closure_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_collections_htg NUMERIC(14,2) DEFAULT 0,
    total_collections_usd NUMERIC(14,2) DEFAULT 0,
    total_expenses_htg NUMERIC(14,2) DEFAULT 0,
    total_expenses_usd NUMERIC(14,2) DEFAULT 0,
    net_total_htg NUMERIC(14,2) DEFAULT 0,
    net_total_usd NUMERIC(14,2) DEFAULT 0,
    transaction_count INT DEFAULT 0,
    breakdown JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_by_name VARCHAR(255),
    validated_by UUID,
    validated_by_name VARCHAR(255),
    validated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql_query: sql1 });
  console.log("SQL 1:", d1, e1);

  const sql2 = `
  ALTER TABLE public.daily_cash_closures ENABLE ROW LEVEL SECURITY;
  `;
  const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_query: sql2 });
  console.log("SQL 2:", d2, e2);

  const sql3 = `
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_cash_closures') THEN
      CREATE POLICY "Enable all for closures" ON public.daily_cash_closures FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
  `;
  const { data: d3, error: e3 } = await supabase.rpc('exec_sql', { sql_query: sql3 });
  console.log("SQL 3:", d3, e3);
}
run();
