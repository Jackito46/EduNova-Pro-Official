CREATE OR REPLACE FUNCTION public.get_db_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'table_name', t.table_name,
            'columns', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'column_name', c.column_name,
                        'data_type', c.data_type
                    )
                )
                FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = t.table_name
            ),
            'foreign_keys', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'constraint_name', tc.constraint_name,
                        'column_name', kcu.column_name,
                        'foreign_table_name', ccu.table_name,
                        'foreign_column_name', ccu.column_name
                    )
                )
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = t.table_name
            )
        )
    ) INTO result
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
    
    RETURN result;
END;
$$;
