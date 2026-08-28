import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql1 = `
    CREATE TABLE IF NOT EXISTS public.fee_plan_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
      fee_plan_id UUID NOT NULL REFERENCES public.fee_plans(id) ON DELETE CASCADE,
      old_inscription_fee NUMERIC NOT NULL,
      new_inscription_fee NUMERIC NOT NULL,
      old_tuition_fee NUMERIC NOT NULL,
      new_tuition_fee NUMERIC NOT NULL,
      change_reason TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      created_by UUID NOT NULL REFERENCES public.profiles(id)
    );
  `;
  const sql2 = `ALTER TABLE public.fee_plan_history ENABLE ROW LEVEL SECURITY;`;
  const sql3 = `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their school fee_plan_history') THEN
        CREATE POLICY "Users can view their school fee_plan_history" ON public.fee_plan_history FOR SELECT USING (school_id = auth.school_id());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Direction can insert fee_plan_history') THEN
        CREATE POLICY "Direction can insert fee_plan_history" ON public.fee_plan_history FOR INSERT WITH CHECK (school_id = auth.school_id());
      END IF;
    END
    $$;
  `;

  let result = await supabase.rpc('exec_sql', { sql_query: sql1 });
  console.log('Result 1:', result);
  result = await supabase.rpc('exec_sql', { sql_query: sql2 });
  console.log('Result 2:', result);
  result = await supabase.rpc('exec_sql', { sql_query: sql3 });
  console.log('Result 3:', result);
}

run();
