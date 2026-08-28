import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Creating dummy school...");
  const { data: newSchool, error: createError } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT id FROM (INSERT INTO public.schools (name, status) VALUES ('DUMMY_SCHOOL_FOR_TEST', 'ACTIVE') RETURNING id) t;" 
  });
  
  if (createError) {
    console.error("Error creating school:", createError);
    return;
  }
  
  const schoolId = newSchool[0].id;
  console.log(`Created school ID: ${schoolId}`);
  
  // Now try to delete it
  console.log(`Deleting school ID: ${schoolId}...`);
  const { error: deleteError } = await supabase
    .from('schools')
    .delete()
    .eq('id', schoolId);
    
  if (deleteError) {
    console.error("Error deleting school:", deleteError);
  } else {
    console.log("Deletion reported success (now verifying persistence...)");
    
    // Verify it's actually gone
    const { data: verifyData } = await supabase.rpc('exec_sql', {
        sql_query: `SELECT count(*) FROM public.schools WHERE id = '${schoolId}';`
    });
    
    if (verifyData[0].count === '0') {
        console.log("VERIFIED: School was successfully deleted from database.");
    } else {
        console.error("FAILED: School still exists in database!");
    }
  }
}

run();
