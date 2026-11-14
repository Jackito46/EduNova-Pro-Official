/**
 * Moteur de Synchronisation Offline-First EduNova Pro
 * - File persistante chiffrée en IndexedDB (rétention illimitée, contrairement aux 24h de Workbox)
 * - Rafraîchissement automatique du jeton JWT Supabase avant dépilement
 * - Déclenchement automatique au retour réseau, gestion backoff exponentiel et batterie faible
 * - Idempotence stricte sur clientTxId + détection et arbitrage des conflits de notes
 */

import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import {
  allocateProvisionalReceiptSeal,
  decryptPayloadWithActiveKey,
  encryptPayloadWithActiveKey,
  ensureOfflineVaultUnlocked,
  generateUuidV4,
  getOrCreateOfflineDeviceId,
  OfflineGradeRecord,
  OfflineGradesBatchRecord,
  OfflineReceiptRecord,
  openOfflineVaultDb,
  saveEncryptedRefCache,
  sealPortableBundle,
  unsealPortableBundle,
  validateGradeBeforeLocalSave,
  validateReceiptBeforeLocalSave,
} from './offlineEncryptedStore';

export type SyncEntityType = 'RECEIPT' | 'GRADES_BATCH';
export type SyncItemStatus = 'PENDING' | 'SYNCING' | 'CONFLICT' | 'FAILED_PERMANENT' | 'SYNCED';

export interface SyncQueueEnvelope {
  id: string; // = clientTxId
  schoolId: string;
  userId: string;
  entityType: SyncEntityType;
  label: string; // Libellé court non sensible pour l'UI sans déchiffrement
  status: SyncItemStatus;
  attempts: number;
  nextRetryAtMs: number;
  createdAtMs: number;
  lastError?: string;
  conflictDetails?: Array<{
    gradeId: string;
    studentName?: string;
    subjectName?: string;
    localScore: number;
    serverScore: number;
    serverUpdatedAt?: string;
  }>;
  iv: string;
  cipher: string;
}

export interface OfflineSyncSummary {
  pendingCount: number;
  receiptCount: number;
  gradesBatchCount: number;
  conflictCount: number;
  failedCount: number;
  syncedCount: number;
  isFlushing: boolean;
  lastSyncedAtMs: number | null;
}

type SyncListener = (summary: OfflineSyncSummary) => void;

const listeners = new Set<SyncListener>();
let flushingPromise: Promise<{ synced: number; conflicts: number; remaining: number }> | null = null;
let lastSyncedAtMs: number | null = null;
let autoFlushInitialized = false;

async function readAllQueueItems(): Promise<SyncQueueEnvelope[]> {
  try {
    const db = await openOfflineVaultDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => resolve((req.result as SyncQueueEnvelope[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function putQueueItem(item: SyncQueueEnvelope): Promise<void> {
  const db = await openOfflineVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    tx.objectStore('sync_queue').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function patchQueueItem(id: string, patch: Partial<SyncQueueEnvelope>): Promise<void> {
  const db = await openOfflineVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) return;
      store.put({ ...req.result, ...patch });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineSyncSummary(schoolId?: string): Promise<OfflineSyncSummary> {
  const all = await readAllQueueItems();
  const scoped = schoolId ? all.filter((i) => i.schoolId === schoolId) : all;

  let pendingCount = 0;
  let receiptCount = 0;
  let gradesBatchCount = 0;
  let conflictCount = 0;
  let failedCount = 0;
  let syncedCount = 0;

  for (const item of scoped) {
    if (item.status === 'PENDING' || item.status === 'SYNCING') {
      pendingCount++;
      if (item.entityType === 'RECEIPT') receiptCount++;
      else if (item.entityType === 'GRADES_BATCH') gradesBatchCount++;
    } else if (item.status === 'CONFLICT') {
      conflictCount++;
    } else if (item.status === 'FAILED_PERMANENT') {
      failedCount++;
    } else if (item.status === 'SYNCED') {
      syncedCount++;
    }
  }

  return {
    pendingCount,
    receiptCount,
    gradesBatchCount,
    conflictCount,
    failedCount,
    syncedCount,
    isFlushing: flushingPromise !== null,
    lastSyncedAtMs,
  };
}

export async function listOfflineQueueEnvelopes(schoolId?: string): Promise<SyncQueueEnvelope[]> {
  const all = await readAllQueueItems();
  const scoped = schoolId ? all.filter((i) => i.schoolId === schoolId) : all;
  return scoped.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

async function notifyListeners(schoolId?: string): Promise<void> {
  const summary = await getOfflineSyncSummary(schoolId);
  listeners.forEach((cb) => {
    try {
      cb(summary);
    } catch {}
  });
}

export function subscribeOfflineSyncState(listener: SyncListener, schoolId?: string): () => void {
  listeners.add(listener);
  void getOfflineSyncSummary(schoolId).then(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Détecte si une erreur Supabase est due à une coupure réseau / timeout plutôt qu'à un rejet métier */
export function isTransientNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('fetch')
  );
}

/** Enregistre et chiffre un reçu scolaire hors-ligne dans IndexedDB */
export async function enqueueOfflineReceipt(input: {
  schoolId: string;
  userId: string;
  studentId: string;
  studentName: string;
  campusId?: string | null;
  academicYearId?: string | null;
  amount: number;
  currency: 'HTG' | 'USD';
  paymentMethod: string;
  feeType: string;
  mappedType: string;
  description: string;
  referenceNumber?: string | null;
  exchangeRate: number;
  amountHtgEquivalent: number;
  amountUsdEquivalent: number;
  cashierName: string;
}): Promise<OfflineReceiptRecord> {
  await ensureOfflineVaultUnlocked(input.userId, input.schoolId);

  const seal = await allocateProvisionalReceiptSeal({
    schoolId: input.schoolId,
    studentId: input.studentId,
    amount: input.amount,
    currency: input.currency,
    cashierId: input.userId,
  });

  const record: OfflineReceiptRecord = {
    clientTxId: seal.clientTxId,
    provisionalNumber: seal.provisionalNumber,
    schoolId: input.schoolId,
    studentId: input.studentId,
    studentName: input.studentName,
    campusId: input.campusId ?? null,
    academicYearId: input.academicYearId ?? null,
    amount: input.amount,
    currency: input.currency,
    paymentMethod: input.paymentMethod,
    feeType: input.feeType,
    mappedType: input.mappedType,
    description: input.description,
    referenceNumber: input.referenceNumber ?? null,
    exchangeRate: input.exchangeRate,
    amountHtgEquivalent: input.amountHtgEquivalent,
    amountUsdEquivalent: input.amountUsdEquivalent,
    cashierId: input.userId,
    cashierName: input.cashierName,
    deviceId: seal.deviceId,
    localSequence: seal.localSequence,
    prevReceiptHash: seal.prevReceiptHash,
    recordHash: seal.recordHash,
    createdAtIso: seal.createdAtIso,
  };

  validateReceiptBeforeLocalSave(record);

  const aad = `${input.schoolId}:RECEIPT:${record.clientTxId}`;
  const { iv, cipher } = await encryptPayloadWithActiveKey(record, aad, input.userId, input.schoolId);

  await putQueueItem({
    id: record.clientTxId,
    schoolId: input.schoolId,
    userId: input.userId,
    entityType: 'RECEIPT',
    label: `Reçu ${seal.provisionalNumber} • ${input.amount} ${input.currency}`,
    status: 'PENDING',
    attempts: 0,
    nextRetryAtMs: Date.now(),
    createdAtMs: Date.now(),
    iv,
    cipher,
  });

  await notifyListeners(input.schoolId);
  return record;
}

/** Enregistre et chiffre un lot de notes hors-ligne dans IndexedDB */
export async function enqueueOfflineGradesBatch(input: {
  schoolId: string;
  userId: string;
  classId: string;
  className: string;
  term: string;
  academicYearId?: string | null;
  grades: Array<Omit<OfflineGradeRecord, 'clientTxId' | 'deviceId' | 'updatedAtIso' | 'recordedBy'>>;
  deletions?: string[];
}): Promise<OfflineGradesBatchRecord> {
  await ensureOfflineVaultUnlocked(input.userId, input.schoolId);
  const deviceId = await getOrCreateOfflineDeviceId();
  const batchTxId = generateUuidV4();
  const updatedAtIso = new Date().toISOString();

  const fullGrades: OfflineGradeRecord[] = input.grades.map((g) => {
    validateGradeBeforeLocalSave(g);
    return {
      ...g,
      clientTxId: generateUuidV4(),
      recordedBy: input.userId,
      deviceId,
      updatedAtIso,
    };
  });

  const batch: OfflineGradesBatchRecord = {
    clientTxId: batchTxId,
    schoolId: input.schoolId,
    classId: input.classId,
    className: input.className,
    term: input.term,
    academicYearId: input.academicYearId ?? null,
    recordedBy: input.userId,
    deviceId,
    updatedAtIso,
    grades: fullGrades,
    deletions: input.deletions || [],
  };

  const aad = `${input.schoolId}:GRADES_BATCH:${batchTxId}`;
  const { iv, cipher } = await encryptPayloadWithActiveKey(batch, aad, input.userId, input.schoolId);

  await putQueueItem({
    id: batchTxId,
    schoolId: input.schoolId,
    userId: input.userId,
    entityType: 'GRADES_BATCH',
    label: `Notes ${input.className} (${input.term}) • ${fullGrades.length} note(s)`,
    status: 'PENDING',
    attempts: 0,
    nextRetryAtMs: Date.now(),
    createdAtMs: Date.now(),
    iv,
    cipher,
  });

  await notifyListeners(input.schoolId);
  return batch;
}

async function isBatteryCriticallyLow(): Promise<boolean> {
  try {
    const getBattery = (navigator as unknown as { getBattery?: () => Promise<{ charging: boolean; level: number }> })
      .getBattery;
    if (!getBattery) return false;
    const battery = await getBattery();
    return !battery.charging && battery.level < 0.12;
  } catch {
    return false;
  }
}

async function pushReceiptToCloud(receipt: OfflineReceiptRecord): Promise<void> {
  const { data, error } = await supabase.rpc('sync_offline_receipt_atomic', {
    p_client_tx_id: receipt.clientTxId,
    p_school_id: receipt.schoolId,
    p_student_id: receipt.studentId,
    p_campus_id: receipt.campusId,
    p_academic_year_id: receipt.academicYearId,
    p_amount: receipt.amount,
    p_currency: receipt.currency,
    p_payment_method: receipt.paymentMethod,
    p_fee_type: receipt.feeType,
    p_type: receipt.mappedType,
    p_nature: receipt.mappedType,
    p_description: receipt.description,
    p_reference_number: receipt.referenceNumber || receipt.provisionalNumber,
    p_exchange_rate: receipt.exchangeRate,
    p_amount_htg_equivalent: receipt.amountHtgEquivalent,
    p_amount_usd_equivalent: receipt.amountUsdEquivalent,
    p_provisional_number: receipt.provisionalNumber,
    p_device_id: receipt.deviceId,
    p_local_seq: receipt.localSequence,
    p_record_hash: receipt.recordHash,
    p_recorded_at: receipt.createdAtIso,
  });

  if (!error) {
    void data;
    return;
  }

  // Fallback transparent si la RPC SQL n'est pas encore déployée sur l'instance Supabase
  const msg = String(error.message || '').toLowerCase();
  const isMissingRpc =
    error.code === 'PGRST202' || error.code === '42883' || msg.includes('sync_offline_receipt_atomic');
  if (!isMissingRpc) {
    throw error;
  }

  // Vérification d'idempotence via reference_number provisoire
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('school_id', receipt.schoolId)
    .eq('reference_number', receipt.provisionalNumber)
    .limit(1);

  if (existing && existing.length > 0) return;

  const fallbackPayload: Record<string, any> = {
    school_id: receipt.schoolId,
    campus_id: receipt.campusId,
    student_id: receipt.studentId,
    amount: receipt.amount,
    currency: receipt.currency,
    payment_method: receipt.paymentMethod,
    fee_type: receipt.feeType,
    type: receipt.mappedType,
    nature: receipt.mappedType,
    description: `${receipt.description} [Hors-ligne ${receipt.provisionalNumber}]`,
    reference_number: receipt.referenceNumber || receipt.provisionalNumber,
    status: 'VALIDE',
    amount_htg_equivalent: receipt.amountHtgEquivalent,
    amount_usd_equivalent: receipt.amountUsdEquivalent,
    exchange_rate_applied: receipt.exchangeRate,
  };
  if (receipt.academicYearId) fallbackPayload.academic_year_id = receipt.academicYearId;

  const { data: inserted, error: insErr } = await supabase.from('payments').insert([fallbackPayload]).select();
  if (insErr) {
    // Fallback minimaliste si certaines colonnes optionnelles manquent
    const minimal: Record<string, any> = {
      school_id: receipt.schoolId,
      student_id: receipt.studentId,
      amount: receipt.amount,
      currency: receipt.currency,
      payment_method: receipt.paymentMethod,
      fee_type: receipt.feeType,
      type: receipt.mappedType,
      nature: receipt.mappedType,
    };
    if (receipt.academicYearId) minimal.academic_year_id = receipt.academicYearId;
    if (receipt.campusId) minimal.campus_id = receipt.campusId;
    const { error: minErr } = await supabase.from('payments').insert([minimal]);
    if (minErr) throw minErr;
  } else if (inserted?.[0]?.id) {
    void AuditLogger.log({
      school_id: receipt.schoolId,
      user_id: receipt.cashierId,
      action: 'OFFLINE_RECEIPT_SYNCED',
      entity_type: 'payment',
      entity_id: inserted[0].id,
      details: {
        provisional_number: receipt.provisionalNumber,
        device_id: receipt.deviceId,
        seal_hash: receipt.recordHash,
      },
    });
  }
}

async function pushGradesBatchToCloud(
  batch: OfflineGradesBatchRecord,
  forceOverwrite = false
): Promise<NonNullable<SyncQueueEnvelope['conflictDetails']>> {
  const conflicts: NonNullable<SyncQueueEnvelope['conflictDetails']> = [];
  let rpcMissing = false;

  for (const g of batch.grades) {
    if (!rpcMissing) {
      const { data: res, error } = await supabase.rpc('sync_offline_grade_versioned', {
        p_client_tx_id: g.clientTxId,
        p_grade_id: g.gradeId,
        p_school_id: g.schoolId,
        p_student_id: g.studentId,
        p_subject_id: g.subjectId,
        p_course_evaluation_id: g.courseEvaluationId ?? null,
        p_academic_year_id: g.academicYearId ?? null,
        p_term: g.term,
        p_score: g.score,
        p_is_sealed: g.isSealed,
        p_base_updated_at: g.baseUpdatedAt ?? null,
        p_force_overwrite: forceOverwrite,
      });

      if (!error) {
        if (res?.status === 'CONFLICT') {
          conflicts.push({
            gradeId: g.gradeId,
            studentName: g.studentName,
            subjectName: g.subjectName,
            localScore: g.score,
            serverScore: Number(res.server_snapshot?.score ?? 0),
            serverUpdatedAt: res.server_snapshot?.updated_at,
          });
        }
        continue;
      }

      const msg = String(error.message || '').toLowerCase();
      if (error.code === 'PGRST202' || error.code === '42883' || msg.includes('sync_offline_grade_versioned')) {
        rpcMissing = true;
      } else {
        throw error;
      }
    }

    // Fallback direct upsert si RPC pas encore migrée
    const payload: Record<string, any> = {
      id: g.gradeId,
      school_id: g.schoolId,
      student_id: g.studentId,
      subject_id: g.subjectId,
      course_evaluation_id: g.courseEvaluationId ?? null,
      term: g.term,
      score: g.score,
      is_sealed: g.isSealed,
    };
    if (g.academicYearId) payload.academic_year_id = g.academicYearId;

    const { error: upErr } = await supabase.from('grades').upsert([payload]);
    if (upErr) throw upErr;
  }

  if (batch.deletions.length > 0) {
    const { error: delErr } = await supabase
      .from('grades')
      .delete()
      .eq('school_id', batch.schoolId)
      .in('id', batch.deletions);
    if (delErr) throw delErr;
  }

  return conflicts;
}

/** Synchronise toute la file d'attente échue vers Supabase */
export async function flushOfflineSyncQueue(options?: {
  schoolId?: string;
  forceManual?: boolean;
}): Promise<{ synced: number; conflicts: number; remaining: number }> {
  if (flushingPromise) return flushingPromise;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const summary = await getOfflineSyncSummary(options?.schoolId);
    return { synced: 0, conflicts: summary.conflictCount, remaining: summary.pendingCount };
  }

  if (!options?.forceManual && (await isBatteryCriticallyLow())) {
    const summary = await getOfflineSyncSummary(options?.schoolId);
    return { synced: 0, conflicts: summary.conflictCount, remaining: summary.pendingCount };
  }

  flushingPromise = (async () => {
    let synced = 0;
    let conflicts = 0;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        throw new Error('Session expirée : reconnectez-vous pour synchroniser les opérations chiffrées.');
      }

      // Rafraîchir le JWT s'il expire dans moins de 2 minutes ou s'il vient d'une longue coupure
      const expiresAtMs = (session.expires_at ?? 0) * 1000;
      if (expiresAtMs - Date.now() < 120_000) {
        await supabase.auth.refreshSession().catch(() => {});
      }

      const allItems = await readAllQueueItems();
      const now = Date.now();
      const due = allItems
        .filter((i) => {
          if (options?.schoolId && i.schoolId !== options.schoolId) return false;
          if (i.status !== 'PENDING') return false;
          return options?.forceManual ? true : i.nextRetryAtMs <= now;
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs); // FIFO strict

      for (const item of due) {
        await patchQueueItem(item.id, { status: 'SYNCING' });
        await notifyListeners(options?.schoolId);

        try {
          const aad = `${item.schoolId}:${item.entityType}:${item.id}`;
          if (item.entityType === 'RECEIPT') {
            const receipt = await decryptPayloadWithActiveKey<OfflineReceiptRecord>(
              { iv: item.iv, cipher: item.cipher },
              aad,
              item.userId,
              item.schoolId
            );
            await pushReceiptToCloud(receipt);
            await patchQueueItem(item.id, { status: 'SYNCED', lastError: undefined });
            synced++;
          } else if (item.entityType === 'GRADES_BATCH') {
            const batch = await decryptPayloadWithActiveKey<OfflineGradesBatchRecord>(
              { iv: item.iv, cipher: item.cipher },
              aad,
              item.userId,
              item.schoolId
            );
            const batchConflicts = await pushGradesBatchToCloud(batch, false);
            if (batchConflicts.length > 0) {
              await patchQueueItem(item.id, {
                status: 'CONFLICT',
                conflictDetails: batchConflicts,
                lastError: `${batchConflicts.length} note(s) modifiée(s) sur le serveur depuis votre saisie.`,
              });
              conflicts++;
            } else {
              await patchQueueItem(item.id, { status: 'SYNCED', lastError: undefined });
              synced++;
            }
          }
        } catch (err: any) {
          const attempts = item.attempts + 1;
          const backoffMs = Math.min(30 * 60_000, 10_000 * Math.pow(3, Math.min(attempts - 1, 5)));
          const msg = err?.message || 'Erreur lors de la synchronisation';
          const isAuthOrVaultError = msg.includes('COFFRE_VERROUILLE');
          const isPermanent = !isAuthOrVaultError && (err?.code === '22P02' || err?.status === 403);

          await patchQueueItem(item.id, {
            status: isPermanent ? 'FAILED_PERMANENT' : 'PENDING',
            attempts,
            nextRetryAtMs: Date.now() + backoffMs,
            lastError: msg,
          });
        }
      }

      if (synced > 0) {
        lastSyncedAtMs = Date.now();
      }
      const after = await getOfflineSyncSummary(options?.schoolId);
      return { synced, conflicts: after.conflictCount + conflicts, remaining: after.pendingCount };
    } finally {
      flushingPromise = null;
      await notifyListeners(options?.schoolId);
    }
  })();

  return flushingPromise;
}

/** Résout manuellement un conflit de notes (conserver version locale ou version serveur) */
export async function resolveGradesConflict(
  envelopeId: string,
  decision: 'KEEP_LOCAL' | 'KEEP_SERVER'
): Promise<void> {
  const all = await readAllQueueItems();
  const target = all.find((i) => i.id === envelopeId);
  if (!target) return;

  if (decision === 'KEEP_SERVER') {
    await patchQueueItem(envelopeId, {
      status: 'SYNCED',
      conflictDetails: undefined,
      lastError: 'Arbitrage : version serveur conservée.',
    });
    await notifyListeners(target.schoolId);
    return;
  }

  const aad = `${target.schoolId}:${target.entityType}:${target.id}`;
  const batch = await decryptPayloadWithActiveKey<OfflineGradesBatchRecord>(
    { iv: target.iv, cipher: target.cipher },
    aad,
    target.userId,
    target.schoolId
  );
  await pushGradesBatchToCloud(batch, true);
  await patchQueueItem(envelopeId, {
    status: 'SYNCED',
    conflictDetails: undefined,
    lastError: undefined,
  });
  lastSyncedAtMs = Date.now();
  await notifyListeners(target.schoolId);
}

/** Supprime les éléments déjà synchronisés pour libérer IndexedDB */
export async function clearSyncedOfflineHistory(schoolId?: string): Promise<number> {
  const db = await openOfflineVaultDb();
  const all = await readAllQueueItems();
  const toDelete = all.filter((i) => i.status === 'SYNCED' && (!schoolId || i.schoolId === schoolId));
  if (toDelete.length === 0) return 0;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    toDelete.forEach((item) => store.delete(item.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await notifyListeners(schoolId);
  return toDelete.length;
}

/** Exporte les opérations en attente vers un fichier .edunova-sync chiffré (transfert USB / WhatsApp) */
export async function exportPendingOperationsBundle(
  schoolId: string,
  passphrase: string
): Promise<{ filename: string; content: string; count: number }> {
  const all = await readAllQueueItems();
  const pending = all.filter(
    (i) => i.schoolId === schoolId && (i.status === 'PENDING' || i.status === 'CONFLICT')
  );
  if (pending.length === 0) {
    throw new Error('Aucune opération en attente à exporter.');
  }

  const decryptedItems: Array<{ envelope: SyncQueueEnvelope; payload: unknown }> = [];
  for (const env of pending) {
    const aad = `${env.schoolId}:${env.entityType}:${env.id}`;
    const payload = await decryptPayloadWithActiveKey(
      { iv: env.iv, cipher: env.cipher },
      aad,
      env.userId,
      env.schoolId
    );
    decryptedItems.push({ envelope: env, payload });
  }

  const content = await sealPortableBundle(JSON.stringify({ schoolId, items: decryptedItems }), passphrase);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return {
    filename: `edunova-secours-${stamp}.edunova-sync`,
    content,
    count: decryptedItems.length,
  };
}

/** Importe un paquet .edunova-sync sur un poste connecté puis déclenche la synchro */
export async function importPortableOperationsBundle(
  bundleText: string,
  passphrase: string,
  currentUserId: string,
  currentSchoolId: string
): Promise<number> {
  const jsonText = await unsealPortableBundle(bundleText, passphrase);
  const parsed = JSON.parse(jsonText) as {
    schoolId: string;
    items: Array<{ envelope: SyncQueueEnvelope; payload: unknown }>;
  };

  if (parsed.schoolId !== currentSchoolId) {
    throw new Error('Ce fichier appartient à un autre établissement scolaire.');
  }

  await ensureOfflineVaultUnlocked(currentUserId, currentSchoolId);
  let imported = 0;

  for (const entry of parsed.items || []) {
    const env = entry.envelope;
    const aad = `${currentSchoolId}:${env.entityType}:${env.id}`;
    const { iv, cipher } = await encryptPayloadWithActiveKey(
      entry.payload,
      aad,
      currentUserId,
      currentSchoolId
    );
    await putQueueItem({
      ...env,
      userId: currentUserId,
      status: 'PENDING',
      nextRetryAtMs: Date.now(),
      iv,
      cipher,
    });
    imported++;
  }

  await notifyListeners(currentSchoolId);
  return imported;
}

/** Démarre les écouteurs automatiques de reconnexion réseau et reprise d'onglet */
export function initOfflineSyncAutoFlush(schoolId?: string): () => void {
  if (autoFlushInitialized) return () => {};
  autoFlushInitialized = true;

  const handleReconnect = () => {
    void flushOfflineSyncQueue({ schoolId });
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void flushOfflineSyncQueue({ schoolId });
    }
  };

  window.addEventListener('online', handleReconnect);
  document.addEventListener('visibilitychange', handleVisibility);

  // Vérification périodique douce toutes les 90s si en ligne et non masqué
  const timer = window.setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') {
      void flushOfflineSyncQueue({ schoolId });
    }
  }, 90_000);

  return () => {
    autoFlushInitialized = false;
    window.removeEventListener('online', handleReconnect);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(timer);
  };
}

/**
 * Précharge et chiffre les tables de référence essentielles (élèves, classes, inscriptions,
 * matières, barèmes, taux de change) dès que la session est en ligne afin de garantir un
 * fonctionnement complet sans Internet dans Registre Élèves, Saisie des Notes et Économat.
 */
export async function prefetchSchoolReferenceCache(
  schoolId: string,
  userId: string,
  force = false
): Promise<{ cachedDatasets: number; studentCount: number; classCount: number }> {
  if (!schoolId || !userId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { cachedDatasets: 0, studentCount: 0, classCount: 0 };
  }

  const throttleKey = `edunova_ref_prefetch_${schoolId}`;
  if (!force) {
    try {
      const last = Number(localStorage.getItem(throttleKey) || '0');
      if (Date.now() - last < 10 * 60 * 1000) {
        return { cachedDatasets: 0, studentCount: 0, classCount: 0 };
      }
    } catch {}
  }

  const unlocked = await ensureOfflineVaultUnlocked(userId, schoolId);
  if (!unlocked) {
    return { cachedDatasets: 0, studentCount: 0, classCount: 0 };
  }

  let cachedDatasets = 0;
  let studentCount = 0;
  let classCount = 0;

  try {
    const [ayRes, clsRes, stRes, enrRes, subRes, csRes, fpRes, rateRes, campRes] = await Promise.all([
      supabase.from('academic_years').select('*').eq('school_id', schoolId).order('label', { ascending: false }),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('*, class:classes(id, name, level, campus_id)').eq('school_id', schoolId).order('last_name'),
      supabase
        .from('enrollments')
        .select('id, student_id, class_id, academic_year_id, status, tuition_discount, tuition_addition, class:classes(id, name, level, campus_id), academic_year:academic_years(id, label, status)')
        .eq('school_id', schoolId),
      supabase.from('subjects').select('id, name, code, category, description').eq('school_id', schoolId).order('name'),
      supabase.from('class_subjects').select('id, class_id, subject_id, coefficient'),
      supabase.from('fee_plans').select('*').eq('school_id', schoolId),
      supabase.from('exchange_rates').select('*').eq('school_id', schoolId),
      supabase.from('ad_hoc_campaigns').select('id, name, amount, currency, campus_id, class_id, academic_year_id').eq('school_id', schoolId),
    ]);

    const saves: Array<Promise<void>> = [];
    if (ayRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_academic_years`, ayRes.data, userId, schoolId));
    }
    if (clsRes.data) {
      cachedDatasets++;
      classCount = clsRes.data.length;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_classes`, clsRes.data, userId, schoolId));
    }
    if (stRes.data) {
      cachedDatasets++;
      studentCount = stRes.data.length;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_students`, stRes.data, userId, schoolId));
    }
    if (enrRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_enrollments`, enrRes.data, userId, schoolId));
    }
    if (subRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_subjects`, subRes.data, userId, schoolId));
    }
    if (csRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_class_subjects`, csRes.data, userId, schoolId));
    }
    if (fpRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_fee_plans`, fpRes.data, userId, schoolId));
    }
    if (rateRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_exchange_rates`, rateRes.data, userId, schoolId));
    }
    if (campRes.data) {
      cachedDatasets++;
      saves.push(saveEncryptedRefCache(`ref_${schoolId}_ad_hoc_campaigns`, campRes.data, userId, schoolId));
    }

    await Promise.all(saves);
    try {
      localStorage.setItem(throttleKey, String(Date.now()));
    } catch {}
  } catch (err) {
    console.warn('[OfflinePrefetch] Préchargement partiel ou interrompu:', err);
  }

  return { cachedDatasets, studentCount, classCount };
}

/** Récupère les notes locales non encore synchronisées pour une classe/période afin de les afficher dans la grille hors-ligne */
export async function getPendingOfflineGradesForClass(
  schoolId: string,
  classId: string,
  term: string
): Promise<OfflineGradeRecord[]> {
  try {
    const all = await readAllQueueItems();
    const pendingBatches = all
      .filter(
        (i) =>
          i.schoolId === schoolId &&
          i.entityType === 'GRADES_BATCH' &&
          (i.status === 'PENDING' || i.status === 'SYNCING' || i.status === 'CONFLICT')
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    const out: OfflineGradeRecord[] = [];
    for (const env of pendingBatches) {
      try {
        const aad = `${env.schoolId}:${env.entityType}:${env.id}`;
        const batch = await decryptPayloadWithActiveKey<OfflineGradesBatchRecord>(
          { iv: env.iv, cipher: env.cipher },
          aad,
          env.userId,
          env.schoolId
        );
        if (batch.classId === classId && batch.term === term) {
          out.push(...batch.grades);
        }
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

