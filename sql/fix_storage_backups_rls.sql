-- =========================================================================
-- EduNova Pro - Configuration & Sécurisation du Bucket Supabase Storage
-- Bucket: database_backups
-- =========================================================================

-- 1. Créer ou mettre à jour le bucket database_backups
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'database_backups',
  'database_backups',
  false,
  104857600, -- 100 Mo max par instantané
  ARRAY['application/json', 'application/gzip', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/json', 'application/gzip', 'application/octet-stream'];

-- 2. Activer RLS sur storage.objects (si pas déjà fait)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Supprimer les anciennes politiques conflictuelles
DROP POLICY IF EXISTS "Allow authenticated users to read backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow full access to database_backups for authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access to database_backups" ON storage.objects;

-- 4. Créer les politiques d'accès complètes pour les utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'database_backups');

CREATE POLICY "Allow authenticated users to upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'database_backups');

CREATE POLICY "Allow authenticated users to update backups"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'database_backups')
WITH CHECK (bucket_id = 'database_backups');

CREATE POLICY "Allow authenticated users to delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'database_backups');

-- 5. Politique d'accès de secours pour l'API backend / service_role
CREATE POLICY "Allow service_role full access to database_backups"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'database_backups')
WITH CHECK (bucket_id = 'database_backups');
