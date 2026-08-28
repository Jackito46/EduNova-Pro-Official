
-- ==========================================================
-- SYSTÈME D'ANNULATION SÉCURISÉE DES TRANSACTIONS
-- ==========================================================

-- 1. Évolution de la table payments (Scolarité)
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. Évolution de la table supply_payments (Fournitures)
ALTER TABLE public.supply_payments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2.5 Évolution de la table school_supplies (Ventes)
ALTER TABLE public.school_supplies 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 3. Mise à jour des politiques RLS pour restreindre l'annulation
-- Seuls les administrateurs ou directeurs peuvent modifier le statut en 'ANNULE'

-- Fonction helper pour vérifier si l'utilisateur est un responsable (Admin ou Directeur)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role IN ('ADMIN', 'DIRECTOR') OR is_super_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Politiques pour payments
DROP POLICY IF EXISTS "Payments manage" ON public.payments;
CREATE POLICY "Payments manage" ON public.payments 
    FOR ALL USING (
        (school_id = public.get_my_school_id() OR public.is_super_admin())
    )
    WITH CHECK (
        -- Si on tente d'annuler, il faut être manager
        (
            (status = 'ANNULE' AND public.is_manager()) 
            OR 
            (status = 'VALIDE')
        )
        AND (school_id = public.get_my_school_id() OR public.is_super_admin())
    );

-- Politiques pour supply_payments
-- Note: supply_payments n'a pas de school_id direct, il passe par school_supplies
DROP POLICY IF EXISTS "Payments isolation manage" ON public.supply_payments;
CREATE POLICY "Payments isolation manage" ON public.supply_payments 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = public.supply_payments.supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    )
    WITH CHECK (
        (
            (status = 'ANNULE' AND public.is_manager()) 
            OR 
            (status = 'VALIDE')
        )
        AND EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );

-- Politiques pour school_supplies
DROP POLICY IF EXISTS "Supplies isolation manage" ON public.school_supplies;
CREATE POLICY "Supplies isolation manage" ON public.school_supplies 
    FOR ALL USING (school_id = public.get_my_school_id())
    WITH CHECK (
        (
            (status = 'ANNULE' AND public.is_manager()) 
            OR 
            (status = 'VALIDE')
        )
        AND school_id = public.get_my_school_id()
    );

-- 4. Rafraîchissement PostgREST
NOTIFY pgrst, 'reload schema';
