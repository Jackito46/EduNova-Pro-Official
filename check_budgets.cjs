const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: cols, error: colErr } = await sb.from('budgets').select('id, school_id, academic_year_id, campus_id, category, planned_amount').limit(0);
  if (colErr) {
    console.log("Error selecting columns:", colErr.message);
  } else {
    console.log("Columns are correct and present!");
  }
}
run();
