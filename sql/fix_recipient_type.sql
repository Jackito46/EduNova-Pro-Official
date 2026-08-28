DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.communication_logs'::regclass
    AND contype = 'c'
    AND conname LIKE '%recipient_type%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.communication_logs DROP CONSTRAINT ' || constraint_name;
    END IF;
    
    ALTER TABLE public.communication_logs 
    ADD CONSTRAINT communication_logs_recipient_type_check 
    CHECK (recipient_type IN ('parents', 'teachers', 'students', 'individual', 'class'));
END $$;
