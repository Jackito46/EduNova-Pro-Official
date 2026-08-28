
-- Table pour les paramètres globaux de la plateforme
CREATE TABLE IF NOT EXISTS public.global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Activation RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Seuls les Super Admins peuvent lire et modifier
CREATE POLICY "Super Admin only access" ON public.global_settings
    FOR ALL USING (public.is_super_admin());

-- Insertion des paramètres par défaut
INSERT INTO public.global_settings (key, value)
VALUES 
    ('platform_identity', '{"name": "EduNova Pro", "support_email": "support@edunova.pro", "logo_url": null}'),
    ('security_policy', '{"min_password_length": 8, "session_timeout": 60, "mfa_required": false}'),
    ('subscription_defaults', '{"trial_days": 30, "max_students": 500, "max_teachers": 50}'),
    ('system_status', '{"maintenance_mode": false, "maintenance_message": "Maintenance en cours..."}')
ON CONFLICT (key) DO NOTHING;

-- Fonction pour récupérer un paramètre global (accessible par tous si besoin, mais ici restreint)
CREATE OR REPLACE FUNCTION public.get_global_setting(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT value FROM public.global_settings WHERE key = p_key);
END;
$$;
