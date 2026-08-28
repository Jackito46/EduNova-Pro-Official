
-- 1. On s'assure que la colonne type existe avec une valeur par défaut
ALTER TABLE IF EXISTS public.payments 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Scolarité';

-- 2. On rafraîchit les privilèges pour être certain que le rôle 'anon' et 'authenticated' voient la colonne
GRANT ALL ON public.payments TO anon, authenticated, service_role;

-- 3. COMMANDE CRITIQUE : Force le rechargement immédiat du cache du serveur d'API (PostgREST)
-- À exécuter absolument dans votre éditeur SQL Supabase
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.payments.type IS 'Nature du versement (Scolarité, Inscription, etc.)';
