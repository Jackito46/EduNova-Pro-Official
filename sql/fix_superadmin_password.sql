-- Fix password hash for jackito46@gmail.com
UPDATE auth.users
SET encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf', 10))
WHERE email = 'jackito46@gmail.com';
