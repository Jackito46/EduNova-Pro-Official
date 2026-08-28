
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function testInsert() {
  const { error } = await supabase.from('profiles').insert({ 
    id: '00000000-0000-0000-0000-000000000000', 
    school_id: 'non-uuid-string' 
  });
  if (error) {
    console.log(`Insert non-uuid error: ${error.message}`);
    if (error.message.includes('invalid input syntax for type uuid')) {
        console.log('CONFIRMED: school_id is UUID type.');
    }
  } else {
    console.log('Insert non-uuid succeeded: school_id is likely TEXT type.');
    // Clean up
    await supabase.from('profiles').delete().eq('id', '00000000-0000-0000-0000-000000000000');
  }
}

testInsert();
