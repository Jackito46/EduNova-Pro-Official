-- Add transaction_id to group supplies purchases
ALTER TABLE public.school_supplies ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_school_supplies_transaction ON public.school_supplies(transaction_id);
