import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sId = 'f06fddee-0b97-47a9-855c-5449b2890fef'; // FRANCOIS Anne

  console.log(`\n--- Verification of get_student_global_debt for FRANCOIS Anne ---`);

  // 1. Call with no exclusion
  const { data: dNoExclude, error: err1 } = await supabase.rpc('get_student_global_debt', { p_student_id: sId });
  if (err1) console.error("Error call 1:", err1);
  else console.log("get_student_global_debt (no exclusion):", dNoExclude);

  // 2. Call with exclude 2025-2026 (ACTIVE)
  const { data: dExcludeActive, error: err2 } = await supabase.rpc('get_student_global_debt', { 
    p_student_id: sId, 
    p_exclude_year_id: '5e3dabc4-47ca-45d2-93f8-17c4626d5ec1' 
  });
  if (err2) console.error("Error call 2:", err2);
  else console.log("get_student_global_debt (excluding ACTIVE 2025-2026):", dExcludeActive);

  // 3. Call with exclude 2026-2027 (FUTURE)
  const { data: dExcludeFuture, error: err3 } = await supabase.rpc('get_student_global_debt', { 
    p_student_id: sId, 
    p_exclude_year_id: 'ea30252c-d1f7-4c09-b101-656d374f1f3a' 
  });
  if (err3) console.error("Error call 3:", err3);
  else console.log("get_student_global_debt (excluding FUTURE 2026-2027):", dExcludeFuture);
}

run();
