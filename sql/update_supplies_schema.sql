ALTER TABLE school_supplies ADD COLUMN IF NOT EXISTS amount_htg_equivalent NUMERIC;
ALTER TABLE school_supplies ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC;

-- Update existing records if possible (assuming currency is HTG if not specified or just fallback)
UPDATE school_supplies SET amount_htg_equivalent = total_amount WHERE amount_htg_equivalent IS NULL AND currency = 'HTG';
UPDATE school_supplies SET amount_htg_equivalent = total_amount * 132.50 WHERE amount_htg_equivalent IS NULL AND currency = 'USD';
