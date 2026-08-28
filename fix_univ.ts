import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUniversity() {
  const code = `
    DELETE FROM public.classes 
    WHERE school_id = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490' AND level IN ('MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE');
    
    DELETE FROM public.subjects 
    WHERE school_id = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490' AND code IN ('FRA', 'MAT', 'CRE', 'ANG', 'SS', 'SP', 'BIO', 'CHI');
    
    PERFORM public.seed_school_data('3dd425c2-2e23-4e3c-a02a-c67ed85ca490');
  `;
  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: `DO $$ BEGIN ${code} END $$;` });
  console.log("data:", JSON.stringify(data, null, 2));
  if (error) console.log("error:", error);
}

fixUniversity();
