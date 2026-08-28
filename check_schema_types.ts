
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_schema_info');
  if (error) {
    // If RPC doesn't exist, try to query information_schema directly
    const { data: columns, error: colError } = await supabase
      .from('pg_attribute')
      .select('attname, atttypid:pg_type(typname), relname:pg_class(relname)')
      .eq('attname', 'school_id')
      .eq('pg_class.relkind', 'r');
    
    if (colError) {
      console.error('Error fetching schema info:', colError);
      return;
    }
    
    console.log('Tables with school_id column:');
    columns.forEach((col: any) => {
      console.log(`- ${col.relname.relname}: ${col.atttypid.typname}`);
    });
  } else {
    console.log(data);
  }
}

// Since I can't easily run arbitrary SQL to create the RPC, I'll use the information_schema via a direct query if possible, 
// but Supabase usually restricts access to pg_catalog.
// I'll try to query a few known tables to see their school_id type.

async function checkKnownTables() {
  const tables = ['profiles', 'classes', 'subjects', 'students', 'fee_plans', 'academic_years', 'schools'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('school_id').limit(1);
      if (error) {
        // If school_id doesn't exist, it might be 'id' for schools table
        if (table === 'schools') {
           const { data: schoolData, error: schoolError } = await supabase.from(table).select('id').limit(1);
           if (!schoolError && schoolData && schoolData.length > 0) {
             console.log(`${table}.id type: ${typeof schoolData[0].id} (value: ${schoolData[0].id})`);
           }
        } else {
          console.log(`${table}: Error or no school_id column (${error.message})`);
        }
      } else if (data && data.length > 0) {
        console.log(`${table}.school_id type: ${typeof data[0].school_id} (value: ${data[0].school_id})`);
      } else {
        console.log(`${table}: No data to check type`);
      }
    } catch (e) {
      console.log(`${table}: Exception checking type`);
    }
  }
}

checkKnownTables();
