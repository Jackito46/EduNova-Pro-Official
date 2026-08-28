DO $$
DECLARE
    v_is_super BOOLEAN;
    v_school_id UUID;
BEGIN
    -- Test is_super_admin (should not fail even if auth.uid() is null)
    BEGIN
        v_is_super := public.is_super_admin();
        RAISE NOTICE 'is_super_admin test: %', v_is_super;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'is_super_admin failed: %', SQLERRM;
    END;

    -- Test get_my_school_id
    BEGIN
        v_school_id := public.get_my_school_id();
        RAISE NOTICE 'get_my_school_id test: %', v_school_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'get_my_school_id failed: %', SQLERRM;
    END;
END $$;
