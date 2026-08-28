DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='currency') THEN
        ALTER TABLE public.expenses ADD COLUMN currency TEXT DEFAULT 'HTG';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='exchange_rate_applied') THEN
        ALTER TABLE public.expenses ADD COLUMN exchange_rate_applied NUMERIC DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='amount_htg_equivalent') THEN
        ALTER TABLE public.expenses ADD COLUMN amount_htg_equivalent NUMERIC;
    END IF;
END $$;
UPDATE public.expenses SET amount_htg_equivalent = amount, currency = 'HTG', exchange_rate_applied = 1 WHERE amount_htg_equivalent IS NULL;
NOTIFY pgrst, 'reload schema';
