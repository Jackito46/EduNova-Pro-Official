import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function findExpenses() {
  const { data: schools } = await supabase.from('schools').select('*').ilike('name', '%INNOVATION%');
  console.log('Schools:', schools);

  if (!schools || schools.length === 0) return;

  const schoolId = schools[0].id;

  const { data: expenses } = await supabase.from('expenses').select('*').eq('school_id', schoolId);
  console.log(`Found ${expenses?.length} expenses`);

  let total = 0;
  expenses?.forEach(e => {
    console.log(`Expense: ${e.title} - amount: ${e.amount} - htg_eq: ${e.amount_htg_equivalent} - date: ${e.expense_date} - year_id: ${e.academic_year_id}`);
    total += Number(e.amount_htg_equivalent || e.amount || 0);
  });
  console.log('Total=', total);
  
  const { data: activeYears } = await supabase.from('academic_years').select('*').eq('school_id', schoolId).eq('is_active', true);
  console.log('Active Years:', activeYears);
}

findExpenses();
