
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function testFeePlansType() {
  const { error } = await supabase.from('fee_plans').insert({ 
    id: '00000000-0000-0000-0000-000000000002', 
    school_id: 'non-uuid-string',
    inscription_fee: 100,
    tuition_fee: 1000
  });
  if (error) {
    console.log(`Insert non-uuid into fee_plans error: ${error.message}`);
    if (error.message.includes('invalid input syntax for type uuid')) {
        console.log('CONFIRMED: fee_plans.school_id is UUID type.');
    }
  } else {
    console.log('Insert non-uuid into fee_plans succeeded: fee_plans.school_id is likely TEXT type.');
    // Clean up
    await supabase.from('fee_plans').delete().eq('id', '00000000-0000-0000-0000-000000000002');
  }
}

testFeePlansType();
