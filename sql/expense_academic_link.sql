
-- 1. Ajout de la colonne de liaison académique
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

-- 2. Indexation pour la vitesse des rapports de fin d'année
CREATE INDEX IF NOT EXISTS idx_expenses_academic_year ON public.expenses(academic_year_id);

-- 3. Notification de recharge
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.expenses.academic_year_id IS 'Lien structurel avec la session académique pour l''audit financier correct.';
