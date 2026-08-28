-- Table for Salary Advances
CREATE TABLE IF NOT EXISTS public.salary_advances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'DEDUCTED')),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approval_date TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.profiles(id),
    payment_method TEXT,
    notes TEXT,
    deduction_period_id UUID REFERENCES public.payroll_periods(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- Policies for salary_advances
DROP POLICY IF EXISTS "Enable read access for all users on salary_advances" ON public.salary_advances;
CREATE POLICY "Enable read access for all users on salary_advances" 
ON public.salary_advances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for admins on salary_advances" ON public.salary_advances;
CREATE POLICY "Enable insert for admins on salary_advances" 
ON public.salary_advances FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'SECRETARY'))
);

DROP POLICY IF EXISTS "Enable update for admins on salary_advances" ON public.salary_advances;
CREATE POLICY "Enable update for admins on salary_advances" 
ON public.salary_advances FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'SECRETARY'))
);
