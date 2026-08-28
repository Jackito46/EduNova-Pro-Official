-- Add 'Dépôt Bancaire' to payment_method constraint in payments table

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('Cash', 'Virement', 'MonCash', 'Chèque', 'Dépôt Bancaire', 'Carte'));

-- If using another table for supplies or salary, add it there as well
ALTER TABLE public.supply_sales DROP CONSTRAINT IF EXISTS supply_sales_payment_method_check;
ALTER TABLE public.supply_sales ADD CONSTRAINT supply_sales_payment_method_check CHECK (payment_method IN ('Cash', 'Virement', 'MonCash', 'Chèque', 'Dépôt Bancaire', 'Carte'));

ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_payment_method_check;
ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_payment_method_check CHECK (payment_method IN ('Cash', 'Virement', 'MonCash', 'Chèque', 'Dépôt Bancaire', 'Carte'));

-- Add columns for bank deposit and check details
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='bank_name') THEN
        ALTER TABLE public.payments ADD COLUMN bank_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='reference_number') THEN
        ALTER TABLE public.payments ADD COLUMN reference_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='deposit_date') THEN
        ALTER TABLE public.payments ADD COLUMN deposit_date DATE;
    END IF;

    -- Also add to school_supplies if necessary
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_supplies' AND column_name='bank_name') THEN
        ALTER TABLE public.school_supplies ADD COLUMN bank_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_supplies' AND column_name='reference_number') THEN
        ALTER TABLE public.school_supplies ADD COLUMN reference_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_supplies' AND column_name='deposit_date') THEN
        ALTER TABLE public.school_supplies ADD COLUMN deposit_date DATE;
    END IF;
END $$;
