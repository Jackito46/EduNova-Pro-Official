-- Table for Payroll Periods
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(school_id, month, year)
);

-- Table for Payroll Slips
CREATE TABLE IF NOT EXISTS public.payroll_slips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
    bonuses NUMERIC(10, 2) NOT NULL DEFAULT 0,
    deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID')),
    payment_date TIMESTAMP WITH TIME ZONE,
    payment_method TEXT,
    paid_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(period_id, staff_id)
);

-- Enable RLS
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;

-- Policies for payroll_periods
DROP POLICY IF EXISTS "Enable read access for all users on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Enable read access for all users on payroll_periods" 
ON public.payroll_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for admins on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Enable insert for admins on payroll_periods" 
ON public.payroll_periods FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'))
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_periods" ON public.payroll_periods;
CREATE POLICY "Enable update for admins on payroll_periods" 
ON public.payroll_periods FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'))
);

-- Policies for payroll_slips
DROP POLICY IF EXISTS "Enable read access for all users on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Enable read access for all users on payroll_slips" 
ON public.payroll_slips FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for admins on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Enable insert for admins on payroll_slips" 
ON public.payroll_slips FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'))
);

DROP POLICY IF EXISTS "Enable update for admins on payroll_slips" ON public.payroll_slips;
CREATE POLICY "Enable update for admins on payroll_slips" 
ON public.payroll_slips FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'))
);
