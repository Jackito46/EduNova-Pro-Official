DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='status') THEN
        ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'VALIDÉ';
    END IF;
END $$;
NOTIFY pgrst, 'reload schema';
