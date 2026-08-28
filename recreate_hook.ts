import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function recreateHook() {
  const code = `
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claims jsonb;
    user_role text;
    user_school_id uuid;
BEGIN
    SELECT role, school_id INTO user_role, user_school_id
    FROM public.profiles
    WHERE id = (event->>'user_id')::uuid;

    claims := event->'claims';

    IF user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
    END IF;
    
    IF user_school_id IS NOT NULL THEN
        claims := jsonb_set(claims, '{app_metadata, school_id}', to_jsonb(user_school_id));
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
EXCEPTION WHEN OTHERS THEN
    RETURN event;
END;
$$;
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: code });
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}

recreateHook();
