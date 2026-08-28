-- Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super Admin only access" ON public.global_settings;
DROP POLICY IF EXISTS "Public read access for global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super admin full access for global_settings" ON public.global_settings;

-- Create policies
CREATE POLICY "Public read access for global_settings" 
ON public.global_settings FOR SELECT 
USING (true);

CREATE POLICY "Super admin full access for global_settings" 
ON public.global_settings FOR ALL 
USING (public.is_super_admin());

-- Insert default system_status if it doesn't exist
INSERT INTO public.global_settings (key, value)
VALUES ('system_status', '{"maintenance_mode": false}')
ON CONFLICT (key) DO NOTHING;
