-- Fix password hash for jomo2004@gmail.com
UPDATE auth.users
SET encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf', 10))
WHERE email = 'jomo2004@gmail.com';
