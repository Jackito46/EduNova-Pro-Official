import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // we want service role to bypass RLS, oh wait VITE... is anon key. I'll login with UMDH credentials or use standard rpc.

// To fetch columns in postgres we can use rpc if available. Many of the existing scripts do this.
