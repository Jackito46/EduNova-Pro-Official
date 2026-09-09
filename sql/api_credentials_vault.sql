-- ==============================================================================
-- MODULE DE CONFIGURATION CENTRALISÉ DES CLÉS API & COFFRE-FORT SÉCURISÉ
-- Chiffrement AES-256-GCM des clés sensibles (MonCash, Natcash, SMTP, Gemini)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL, -- 'moncash', 'natcash', 'smtp', 'sms', 'gemini'
    key_name TEXT NOT NULL, -- 'MONCASH_CLIENT_ID', 'MONCASH_CLIENT_SECRET', etc.
    key_value TEXT, -- Valeur en clair pour les identifiants publics
    encrypted_value TEXT, -- Valeur chiffrée (AES-256-GCM: enc:v1:<iv>:<tag>:<ciphertext>) pour les secrets
    is_secret BOOLEAN DEFAULT false,
    environment TEXT DEFAULT 'production', -- 'sandbox', 'live', 'production'
    is_active BOOLEAN DEFAULT true,
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'UNTESTED', -- 'VALID', 'INVALID', 'UNTESTED', 'ERROR'
    validation_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_api_credentials UNIQUE (school_id, service_name, key_name, environment)
);

-- Index de recherche rapide
CREATE INDEX IF NOT EXISTS idx_api_credentials_lookup 
    ON public.api_credentials (school_id, service_name, environment);

-- Sécurité Row Level Security (RLS)
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'api_credentials' 
          AND policyname = 'allow_school_members_api_creds'
    ) THEN
        CREATE POLICY allow_school_members_api_creds ON public.api_credentials
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
