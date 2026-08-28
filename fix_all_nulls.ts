import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllNulls() {
  const code = `
    UPDATE auth.users 
    SET 
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      encrypted_password = CASE WHEN encrypted_password LIKE '$2a$06$%' THEN extensions.crypt('admin123', extensions.gen_salt('bf', 10)) ELSE encrypted_password END
    WHERE true;

    CREATE OR REPLACE FUNCTION auth_user_defaults()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.confirmation_token = COALESCE(NEW.confirmation_token, '');
      NEW.recovery_token = COALESCE(NEW.recovery_token, '');
      NEW.email_change_token_new = COALESCE(NEW.email_change_token_new, '');
      NEW.email_change = COALESCE(NEW.email_change, '');
      NEW.phone_change_token = COALESCE(NEW.phone_change_token, '');
      NEW.email_change_token_current = COALESCE(NEW.email_change_token_current, '');
      NEW.reauthentication_token = COALESCE(NEW.reauthentication_token, '');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS ensure_auth_user_defaults ON auth.users;
    CREATE TRIGGER ensure_auth_user_defaults
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth_user_defaults();
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: code });
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}

fixAllNulls();
