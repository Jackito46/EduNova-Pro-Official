SELECT public.admin_create_tenant(
    'Ecole Test ' || (now()::text),
    'admin_' || (extract(epoch from now())::text) || '@example.com',
    'password123',
    'Admin Test'
);
