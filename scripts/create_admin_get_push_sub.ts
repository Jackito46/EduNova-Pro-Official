import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { error } = await supabase.rpc('exec_ddl', {
    ddl_query: `
      CREATE OR REPLACE FUNCTION admin_get_push_subscriptions(p_school_id UUID, p_roles TEXT[] DEFAULT NULL, p_class_id UUID DEFAULT NULL)
      RETURNS TABLE(endpoint TEXT, p256dh TEXT, auth TEXT, user_id TEXT, role TEXT)
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth, ps.user_id::text, pr.role::text
        FROM public.push_subscriptions ps
        JOIN public.profiles pr ON ps.user_id = pr.id
        LEFT JOIN public.students s ON s.id = pr.id
        LEFT JOIN public.students s_parent ON pr.email = s_parent.parent_email
        WHERE ps.school_id = p_school_id
          AND (p_roles IS NULL OR pr.role::text = ANY(p_roles))
          AND (
            p_class_id IS NULL OR 
            pr.role::text NOT IN ('STUDENT', 'PARENT') OR
            (s.class_id = p_class_id) OR
            (s_parent.class_id = p_class_id)
          );
      END;
      $$;
      CREATE OR REPLACE FUNCTION admin_delete_push_subscription(p_endpoint TEXT)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
      END;
      $$;
    `
  });
  if (error) console.error(error);
  else {
    console.log('admin_get_push_subscriptions and delete created.');
    const { error: error2 } = await supabase.rpc('exec_ddl', { ddl_query: `NOTIFY pgrst, 'reload schema'` });
    if (error2) console.error(error2); else console.log('schema reloaded');
  }
}
run();
