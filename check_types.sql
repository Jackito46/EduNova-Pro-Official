
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    column_name = 'school_id' 
    AND table_schema = 'public'
ORDER BY 
    table_name;
