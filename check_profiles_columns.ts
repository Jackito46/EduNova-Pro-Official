
import { supabase } from './supabase';

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'profiles' });
  if (error) {
    console.error('Error fetching columns:', error);
    // Fallback: try to select one row and see the keys
    const { data: row, error: rowError } = await supabase.from('profiles').select('*').limit(1).single();
    if (rowError) {
      console.error('Error fetching row:', rowError);
    } else {
      console.log('Columns in profiles:', Object.keys(row));
    }
  } else {
    console.log('Columns in profiles:', data);
  }
}

checkColumns();
