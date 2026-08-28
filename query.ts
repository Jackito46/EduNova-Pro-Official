import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: "ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;" });
    console.log("exec_ddl:", data, error);
    
    const { data: d2, error: e2 } = await supabase.rpc('exec_ddl', { ddl_query: "ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;" });
    console.log("exec_ddl 2:", d2, e2);
    
    const { data: d3, error: e3 } = await supabase.rpc('exec_ddl', { ddl_query: "ALTER TABLE public.supply_catalog ADD COLUMN IF NOT EXISTS discipline_name TEXT;" });
    console.log("exec_ddl 3:", d3, e3);
    
    await supabase.rpc('exec_ddl', { ddl_query: "NOTIFY pgrst, 'reload schema';" });
}
main();
