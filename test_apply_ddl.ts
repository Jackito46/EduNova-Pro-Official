import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
  CREATE TABLE IF NOT EXISTS public.daily_cash_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    campus_id UUID REFERENCES public.school_campuses(id) ON DELETE CASCADE,
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
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255),
    validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    validated_by_name VARCHAR(255),
    validated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_school_campus_closure_date UNIQUE (school_id, campus_id, closure_date)
  );

  ALTER TABLE public.daily_cash_closures ENABLE ROW LEVEL SECURITY;

  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_cash_closures') THEN
      CREATE POLICY "Enable all for closures" ON public.daily_cash_closures FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
  `;

  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log("Result:", data, error);
}
run();
