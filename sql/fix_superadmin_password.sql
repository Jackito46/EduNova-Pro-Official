-- Fix password hash and identities for Super Admin jackito46@gmail.com
DO $$
BEGIN
  -- 1. Fix auth.users for jackito46@gmail.com
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'SUPER_ADMIN', 'is_super_admin', true),
    raw_user_meta_data = jsonb_build_object('full_name', 'Jackito (Master)', 'is_super_admin', true, 'role', 'SUPER_ADMIN')
  WHERE email = 'jackito46@gmail.com';

  -- 2. Fix auth.identities
  UPDATE auth.identities
  SET 
    identity_data = jsonb_build_object('sub', user_id::text, 'email', 'jackito46@gmail.com', 'email_verified', true, 'phone_verified', false),
    updated_at = now()
  WHERE user_id = 'a0ed9087-0554-40ae-ac26-86599a183b16';

  -- 3. Fix profiles
  UPDATE public.profiles
  SET 
    failed_login_attempts = 0,
    failed_attempts = 0,
    is_active = true,
    is_super_admin = true,
    role = 'SUPER_ADMIN'
  WHERE email = 'jackito46@gmail.com';
END $$;
