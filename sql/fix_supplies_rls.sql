-- Fix RLS policy for school_supplies and supply_payments

-- 1. Ensure school_id is UUID in school_supplies
ALTER TABLE public.school_supplies ALTER COLUMN school_id TYPE UUID USING school_id::uuid;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Supplies isolation read" ON public.school_supplies;
DROP POLICY IF EXISTS "Supplies isolation insert" ON public.school_supplies;
DROP POLICY IF EXISTS "Supplies isolation manage" ON public.school_supplies;

DROP POLICY IF EXISTS "Payments isolation read" ON public.supply_payments;
DROP POLICY IF EXISTS "Payments isolation insert" ON public.supply_payments;
DROP POLICY IF EXISTS "Payments isolation manage" ON public.supply_payments;

-- 3. Recreate policies for school_supplies
CREATE POLICY "Supplies isolation read" ON public.school_supplies 
    FOR SELECT USING (school_id = public.get_my_school_id());

CREATE POLICY "Supplies isolation insert" ON public.school_supplies 
    FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

CREATE POLICY "Supplies isolation manage" ON public.school_supplies 
    FOR ALL USING (school_id = public.get_my_school_id());

-- 4. Recreate policies for supply_payments
CREATE POLICY "Payments isolation read" ON public.supply_payments 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = public.supply_payments.supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );

CREATE POLICY "Payments isolation insert" ON public.supply_payments 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );

CREATE POLICY "Payments isolation manage" ON public.supply_payments 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_supplies 
            WHERE public.school_supplies.id = supply_id 
            AND public.school_supplies.school_id = public.get_my_school_id()
        )
    );
