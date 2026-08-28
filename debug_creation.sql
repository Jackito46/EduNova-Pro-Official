DO $$ 
BEGIN
    -- Try to call the function and see what happens
    -- We use JACKITO's email to bypass super admin check
    PERFORM public.admin_create_tenant(
        'Ecole Test 123',
        'admin_test_123@example.com',
        'password123',
        'Admin Test'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'An error occurred: %', SQLERRM;
    RAISE NOTICE 'Error detail: %', SQLSTATE;
END $$;
