
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function testStudentsType() {
  const { error } = await supabase.from('students').insert({ 
    id: '00000000-0000-0000-0000-000000000001', 
    school_id: 'non-uuid-string',
    first_name: 'Test',
    last_name: 'Student',
    dob: '2010-01-01',
    parent_name: 'Parent',
    parent_relation: 'Father',
    parent_phone: '12345678'
  });
  if (error) {
    console.log(`Insert non-uuid into students error: ${error.message}`);
    if (error.message.includes('invalid input syntax for type uuid')) {
        console.log('CONFIRMED: students.school_id is UUID type.');
    }
  } else {
    console.log('Insert non-uuid into students succeeded: students.school_id is likely TEXT type.');
    // Clean up
    await supabase.from('students').delete().eq('id', '00000000-0000-0000-0000-000000000001');
  }
}

testStudentsType();
