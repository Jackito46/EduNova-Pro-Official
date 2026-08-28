import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { error } = await supabase.rpc('exec_ddl', {
    ddl_query: `
      CREATE TABLE IF NOT EXISTS public.push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Optional: Allow users to read/insert their own subscriptions
      ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
      CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions
        FOR ALL USING (auth.uid() = user_id);
    `
  });
  if (error) console.error(error);
  else console.log('push_subscriptions table created or already exists');
}
run();
