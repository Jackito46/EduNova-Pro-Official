
-- ==========================================================
-- SCRIPT DE DÉBLOCAGE D'ACCÈS - EduNova Pro
-- Force la confirmation de l'email pour éviter l'erreur "Email not confirmed"
-- ==========================================================

-- 1. On marque l'utilisateur comme confirmé
UPDATE auth.users 
SET 
    email_confirmed_at = NOW(),
    updated_at = NOW(),
    last_sign_in_at = NOW(),
    raw_app_meta_data = raw_app_meta_data || '{"provider":"email", "providers":["email"]}'::jsonb
WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16';

-- 2. On s'assure que le profil public est aussi synchronisé
UPDATE public.profiles
SET 
    role = 'SCHOOL_ADMIN',
    school_id = 'school-2025-premium'
WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16';

-- 3. Vérification du statut (doit afficher une date dans email_confirmed_at)
SELECT id, email, email_confirmed_at, last_sign_in_at 
FROM auth.users 
WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16';
