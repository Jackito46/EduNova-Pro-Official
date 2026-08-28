-- Fix missing identity and providers for jomo2004@gmail.com and any other user

-- 1. Update raw_app_meta_data to include email provider
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE raw_app_meta_data->>'provider' IS NULL OR raw_app_meta_data->>'providers' IS NULL;

-- 2. Insert missing identities
INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
);

-- 3. Ensure email is confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;
