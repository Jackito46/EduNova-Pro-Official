import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRPCs() {
  const code = `
    CREATE OR REPLACE FUNCTION public.admin_reset_password(
        p_user_id UUID,
        p_new_password TEXT
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions
    AS $$
    DECLARE
        v_is_super boolean;
    BEGIN
        SELECT is_super_admin INTO v_is_super
        FROM public.profiles
        WHERE id = auth.uid();

        IF COALESCE(v_is_super, false) = false THEN
            RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
        END IF;

        UPDATE auth.users
        SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = p_user_id;

        RETURN jsonb_build_object('success', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
    $$;
  `;
  await supabase.rpc('apply_ddl', { v_sql: code });
  
  // Actually, wait, let me just reset the user's password back to 'admin123' so they know what it is?
  // They probably already used "admin123" because that was the default password.
  console.log("Fixed admin_reset_password to use cost 10");
}

fixRPCs();
