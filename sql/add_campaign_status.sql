DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ad_hoc_campaigns' AND column_name = 'status') THEN
        ALTER TABLE public.ad_hoc_campaigns ADD COLUMN status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROGRESS', 'COMPLETED'));
    END IF;
END $$;
