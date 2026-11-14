-- ============================================================================
-- EduNova Pro — Synchronisation Offline-First Atomique & Résolution de Conflits
-- Exécuter dans l'éditeur SQL Supabase pour activer les RPC atomiques P0.
-- ============================================================================

-- 1. Colonnes de traçabilité hors-ligne sur payments (idempotentes)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_tx_id UUID,
  ADD COLUMN IF NOT EXISTS offline_provisional_number TEXT,
  ADD COLUMN IF NOT EXISTS offline_device_id TEXT,
  ADD COLUMN IF NOT EXISTS offline_local_seq INTEGER,
  ADD COLUMN IF NOT EXISTS offline_seal_hash TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_client_tx_id_unique
  ON public.payments (client_tx_id)
  WHERE client_tx_id IS NOT NULL;

-- 2. Colonnes de versionnement et d'idempotence sur grades
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS client_tx_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_client_tx_id_unique
  ON public.grades (client_tx_id)
  WHERE client_tx_id IS NOT NULL;

-- Trigger pour maintenir updated_at sur grades lors de toute modification serveur
CREATE OR REPLACE FUNCTION public.edunova_touch_grades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grades_touch_updated_at ON public.grades;
CREATE TRIGGER trg_grades_touch_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW
  EXECUTE FUNCTION public.edunova_touch_grades_updated_at();

-- ============================================================================
-- 3. RPC Atomique & Idempotente : Synchronisation de Reçu Hors-Ligne
--    - Empêche les doublons même si le réseau coupe pendant la réponse HTTP
--    - Attribue le numéro officiel de reçu côté serveur
--    - Enregistre l'audit et signale toute dérive d'horloge (> 24h)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_offline_receipt_atomic(
  p_client_tx_id UUID,
  p_school_id UUID,
  p_student_id UUID,
  p_campus_id UUID DEFAULT NULL,
  p_academic_year_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'HTG',
  p_payment_method TEXT DEFAULT 'Espèces',
  p_fee_type TEXT DEFAULT 'SCOLARITE',
  p_type TEXT DEFAULT 'Frais de Scolarité',
  p_nature TEXT DEFAULT 'Frais de Scolarité',
  p_description TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_exchange_rate NUMERIC DEFAULT 140,
  p_amount_htg_equivalent NUMERIC DEFAULT NULL,
  p_amount_usd_equivalent NUMERIC DEFAULT NULL,
  p_provisional_number TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_local_seq INTEGER DEFAULT NULL,
  p_record_hash TEXT DEFAULT NULL,
  p_recorded_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_school UUID;
  v_user_role TEXT;
  v_existing_id UUID;
  v_new_id UUID;
  v_official_ref TEXT;
  v_clock_drift_seconds NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour synchroniser un reçu hors-ligne.';
  END IF;

  SELECT school_id, role::text INTO v_user_school, v_user_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_user_role IS NULL OR (v_user_role <> 'SUPER_ADMIN' AND v_user_school IS DISTINCT FROM p_school_id) THEN
    RAISE EXCEPTION 'Accès refusé : établissement non autorisé pour cet utilisateur.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 5000000 THEN
    RAISE EXCEPTION 'Montant de paiement invalide (%).', p_amount;
  END IF;

  -- Idempotence stricte : si déjà synchronisé, renvoyer l'ID existant sans dupliquer
  SELECT id INTO v_existing_id
  FROM public.payments
  WHERE client_tx_id = p_client_tx_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_SYNCED',
      'id', v_existing_id,
      'official_ref', COALESCE(p_reference_number, 'RCP-' || upper(substr(v_existing_id::text, 1, 8)))
    );
  END IF;

  INSERT INTO public.payments (
    school_id,
    campus_id,
    student_id,
    academic_year_id,
    amount,
    currency,
    payment_method,
    fee_type,
    type,
    nature,
    description,
    reference_number,
    status,
    exchange_rate_applied,
    amount_htg_equivalent,
    amount_usd_equivalent,
    client_tx_id,
    offline_provisional_number,
    offline_device_id,
    offline_local_seq,
    offline_seal_hash,
    synced_at,
    created_at
  )
  VALUES (
    p_school_id,
    p_campus_id,
    p_student_id,
    p_academic_year_id,
    p_amount,
    COALESCE(p_currency, 'HTG'),
    COALESCE(p_payment_method, 'Espèces'),
    COALESCE(p_fee_type, 'SCOLARITE'),
    COALESCE(p_type, 'Frais de Scolarité'),
    COALESCE(p_nature, 'Frais de Scolarité'),
    COALESCE(p_description, 'Encaissement hors-ligne synchronisé (' || COALESCE(p_provisional_number, 'LOCAL') || ')'),
    p_reference_number,
    'VALIDE',
    COALESCE(p_exchange_rate, 140),
    p_amount_htg_equivalent,
    p_amount_usd_equivalent,
    p_client_tx_id,
    p_provisional_number,
    p_device_id,
    p_local_seq,
    p_record_hash,
    now(),
    COALESCE(p_recorded_at, now())
  )
  RETURNING id INTO v_new_id;

  v_official_ref := COALESCE(NULLIF(p_reference_number, ''), 'RCP-' || upper(substr(v_new_id::text, 1, 8)));
  v_clock_drift_seconds := abs(extract(epoch FROM (now() - COALESCE(p_recorded_at, now()))));

  -- Journal d'audit inviolable avec détection de dérive d'horloge (> 24h)
  INSERT INTO public.audit_logs (
    school_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_school_id,
    v_uid,
    'OFFLINE_RECEIPT_SYNCED',
    'payment',
    v_new_id::text,
    jsonb_build_object(
      'client_tx_id', p_client_tx_id,
      'provisional_number', p_provisional_number,
      'official_ref', v_official_ref,
      'device_id', p_device_id,
      'local_seq', p_local_seq,
      'seal_hash', p_record_hash,
      'recorded_at', p_recorded_at,
      'clock_drift_warning', v_clock_drift_seconds > 86400
    )
  );

  RETURN jsonb_build_object(
    'status', 'SYNCED',
    'id', v_new_id,
    'official_ref', v_official_ref
  );
END;
$$;

-- ============================================================================
-- 4. RPC Versionnée : Synchronisation de Note avec Détection de Conflits
--    - Ne jamais écraser silencieusement une note modifiée sur le serveur
--      entre le chargement hors-ligne et la reconnexion.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_offline_grade_versioned(
  p_client_tx_id UUID,
  p_grade_id UUID,
  p_school_id UUID,
  p_student_id UUID,
  p_subject_id UUID,
  p_course_evaluation_id UUID DEFAULT NULL,
  p_academic_year_id UUID DEFAULT NULL,
  p_term TEXT DEFAULT 'Trimestre 1',
  p_score NUMERIC DEFAULT 0,
  p_is_sealed BOOLEAN DEFAULT TRUE,
  p_base_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_force_overwrite BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_school UUID;
  v_user_role TEXT;
  v_existing RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour synchroniser une note.';
  END IF;

  SELECT school_id, role::text INTO v_user_school, v_user_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_user_role IS NULL OR (v_user_role <> 'SUPER_ADMIN' AND v_user_school IS DISTINCT FROM p_school_id) THEN
    RAISE EXCEPTION 'Accès refusé : établissement non autorisé.';
  END IF;

  SELECT id, score, updated_at, is_sealed, client_tx_id
  INTO v_existing
  FROM public.grades
  WHERE id = p_grade_id
     OR (
       school_id = p_school_id
       AND student_id = p_student_id
       AND subject_id = p_subject_id
       AND term = p_term
       AND (
         (p_course_evaluation_id IS NULL AND course_evaluation_id IS NULL)
         OR course_evaluation_id = p_course_evaluation_id
       )
     )
  LIMIT 1;

  -- Idempotence si exactement la même transaction client a déjà abouti
  IF v_existing.id IS NOT NULL AND v_existing.client_tx_id = p_client_tx_id THEN
    RETURN jsonb_build_object('status', 'ALREADY_SYNCED', 'id', v_existing.id);
  END IF;

  -- Détection de conflit : la note serveur a changé après notre version locale de référence
  IF v_existing.id IS NOT NULL
     AND NOT p_force_overwrite
     AND p_base_updated_at IS NOT NULL
     AND v_existing.updated_at IS NOT NULL
     AND v_existing.updated_at > p_base_updated_at
     AND v_existing.score IS DISTINCT FROM p_score THEN
    RETURN jsonb_build_object(
      'status', 'CONFLICT',
      'id', v_existing.id,
      'server_snapshot', jsonb_build_object(
        'id', v_existing.id,
        'score', v_existing.score,
        'updated_at', v_existing.updated_at,
        'is_sealed', v_existing.is_sealed
      )
    );
  END IF;

  INSERT INTO public.grades (
    id,
    school_id,
    student_id,
    subject_id,
    course_evaluation_id,
    academic_year_id,
    term,
    score,
    is_sealed,
    client_tx_id,
    updated_at
  )
  VALUES (
    COALESCE(v_existing.id, p_grade_id),
    p_school_id,
    p_student_id,
    p_subject_id,
    p_course_evaluation_id,
    p_academic_year_id,
    p_term,
    p_score,
    COALESCE(p_is_sealed, TRUE),
    p_client_tx_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    score = EXCLUDED.score,
    is_sealed = EXCLUDED.is_sealed,
    client_tx_id = EXCLUDED.client_tx_id,
    updated_at = now();

  RETURN jsonb_build_object('status', 'SYNCED', 'id', COALESCE(v_existing.id, p_grade_id));
END;
$$;
