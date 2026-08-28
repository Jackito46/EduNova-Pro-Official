-- Table pour le suivi des rappels d'abonnement envoyés
CREATE TABLE IF NOT EXISTS public.subscription_reminders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    days_before integer NOT NULL, -- 7, 3, ou 1
    sent_at timestamp with time zone DEFAULT now(),
    UNIQUE(school_id, days_before)
);

-- Index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_subscription_reminders_school ON public.subscription_reminders(school_id);
