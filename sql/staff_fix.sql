
-- ==========================================================
-- SCRIPT DE MAINTENANCE & RÉCUPÉRATION - EduNova Pro
-- 1. Réinitialisation Mot de Passe
-- 2. Recréation Table Staff (Personnel)
-- ==========================================================

-- A. RÉCUPÉRATION DE COMPTE (Mot de passe : admin1234)
-- On utilise l'extension pgcrypto pour hasher le mot de passe dans la table auth.users
UPDATE auth.users 
SET encrypted_password = extensions.crypt('admin1234', extensions.gen_salt('bf'))
WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16';

-- B. RECRÉATION DE LA TABLE STAFF (SÉCURISÉE)
DROP TABLE IF EXISTS public.staff CASCADE;

CREATE TABLE public.staff (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID DEFAULT 'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT,
    dob DATE,
    nif_cin TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'Enseignant',
    contract_type TEXT CHECK (contract_type IN ('Permanent', 'Vacationnaire')),
    pay_type TEXT CHECK (pay_type IN ('Fixe', 'Horaire')),
    amount NUMERIC DEFAULT 0,
    weekly_hours NUMERIC DEFAULT 0,
    bank_name TEXT,
    bank_account TEXT,
    subjects TEXT[] DEFAULT '{}',
    qualifications TEXT,
    status TEXT DEFAULT 'Actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (Basées sur school_id UUID)
CREATE POLICY "Staff view policy" ON public.staff 
    FOR SELECT USING (school_id = public.get_my_school_id());

CREATE POLICY "Staff manage policy" ON public.staff 
    FOR ALL USING (public.is_admin());

-- C. INSERTION D'UN EXEMPLE (Optionnel)
INSERT INTO public.staff (first_name, last_name, role, contract_type, pay_type, amount, school_id)
VALUES ('Jean', 'PROFSPEC', 'Enseignant', 'Permanent', 'Fixe', 25000, 'a0ed9087-0554-40ae-ac26-86599a183b16'::uuid);

-- D. VÉRIFICATION FINALE
SELECT email, encrypted_password FROM auth.users WHERE id = 'a0ed9087-0554-40ae-ac26-86599a183b16';
