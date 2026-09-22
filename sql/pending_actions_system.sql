-- Table et RLS pour le Système de Double Regard (Four-Eyes Principle / Quorum)
-- Permet de consigner les opérations critiques initiées par des comptes sous tutelle ou en mode autonome,
-- ou nécessitant une validation formelle par un Administrateur certifié RH.

CREATE TABLE IF NOT EXISTS public.pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    campus_id UUID,
    action_type TEXT NOT NULL,
    action_title TEXT NOT NULL,
    description TEXT,
    target_entity_type TEXT NOT NULL,
    target_entity_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requester_id UUID NOT NULL,
    requester_name TEXT,
    requester_email TEXT,
    requester_role TEXT,
    is_autonomous_requester BOOLEAN DEFAULT false,
    reviewed_by UUID,
    reviewer_name TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    execution_status TEXT DEFAULT 'IDLE' CHECK (execution_status IN ('IDLE', 'SUCCESS', 'FAILED')),
    execution_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_school ON public.pending_actions(school_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON public.pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_created_at ON public.pending_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_actions_requester ON public.pending_actions(requester_id);

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pending actions" ON public.pending_actions;
CREATE POLICY "Users can view pending actions" ON public.pending_actions FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can insert pending actions" ON public.pending_actions;
CREATE POLICY "Users can insert pending actions" ON public.pending_actions FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update pending actions" ON public.pending_actions;
CREATE POLICY "Users can update pending actions" ON public.pending_actions FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete pending actions" ON public.pending_actions;
CREATE POLICY "Users can delete pending actions" ON public.pending_actions FOR DELETE TO authenticated, anon USING (true);
