-- ==========================================================
-- MISE À JOUR MULTI-DEVISES POUR LES DÉPENSES (CHARGES)
-- ==========================================================

-- 1. Ajout des colonnes multi-devises à la table expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('HTG', 'USD')) DEFAULT 'HTG',
ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC,
ADD COLUMN IF NOT EXISTS amount_htg_equivalent NUMERIC;

-- 2. Migration des données existantes
UPDATE public.expenses 
SET 
    currency = 'HTG',
    amount_htg_equivalent = amount,
    exchange_rate_applied = 1
WHERE currency IS NULL;

-- 3. Fonction Trigger pour le calcul automatique de l'équivalent HTG
CREATE OR REPLACE FUNCTION public.process_expense_currency()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.currency = 'USD' THEN
        -- Si le taux n'est pas fourni, on prend le taux actuel
        IF NEW.exchange_rate_applied IS NULL THEN
            NEW.exchange_rate_applied := public.get_current_exchange_rate(NEW.school_id);
        END IF;
        NEW.amount_htg_equivalent := NEW.amount * NEW.exchange_rate_applied;
    ELSE
        NEW.exchange_rate_applied := 1;
        NEW.amount_htg_equivalent := NEW.amount;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Application du Trigger
DROP TRIGGER IF EXISTS handle_expense_currency_trigger ON public.expenses;
CREATE TRIGGER handle_expense_currency_trigger
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.process_expense_currency();

-- 5. Rafraîchissement du cache
NOTIFY pgrst, 'reload schema';
