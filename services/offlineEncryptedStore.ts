/**
 * Coffre de Stockage Local Chiffré (AES-256-GCM + Web Crypto API + IndexedDB)
 * Conçu pour les zones à connectivité intermittente (Haïti) :
 * - Chiffrement AES-256-GCM en navigateur avec clé non-extractible conservée en RAM uniquement
 * - Chaînage cryptographique SHA-256 (append-only ledger) pour les reçus hors-ligne
 * - Prévention des doublons via clientTxId (UUID) + séquence locale monotone par appareil
 * - Portage d'urgence (.edunova-sync) par clé USB / WhatsApp en cas de panne prolongée
 */

export interface OfflineReceiptRecord {
  clientTxId: string;
  provisionalNumber: string;
  schoolId: string;
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
  cashierId: string;
  cashierName: string;
  deviceId: string;
  localSequence: number;
  prevReceiptHash: string;
  recordHash: string;
  createdAtIso: string;
}

export interface OfflineGradeRecord {
  clientTxId: string;
  gradeId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  courseEvaluationId?: string | null;
  academicYearId?: string | null;
  className?: string;
  term: string;
  score: number;
  maxScore: number;
  isSealed: boolean;
  recordedBy: string;
  deviceId: string;
  baseUpdatedAt?: string | null;
  updatedAtIso: string;
}

export interface OfflineGradesBatchRecord {
  clientTxId: string;
  schoolId: string;
  classId: string;
  className: string;
  term: string;
  academicYearId?: string | null;
  recordedBy: string;
  deviceId: string;
  updatedAtIso: string;
  grades: OfflineGradeRecord[];
  deletions: string[];
}

export interface StorageQuotaHealth {
  persisted: boolean;
  usedMb: number;
  quotaMb: number;
  usageRatio: number;
}

const DB_NAME = 'edunova_offline_vault_v1';
const DB_VERSION = 1;
const PIN_HASH_META_PREFIX = 'pin_hash_';

let activeAesKey: CryptoKey | null = null;
let activeVaultIdentity: string | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function openOfflineVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponible dans ce navigateur.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
        store.createIndex('by_status_created', ['status', 'createdAtMs']);
        store.createIndex('by_school', 'schoolId');
      }
      if (!db.objectStoreNames.contains('ref_cache')) {
        db.createObjectStore('ref_cache', { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains('device_meta')) {
        db.createObjectStore('device_meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getMeta<T = any>(key: string): Promise<T | null> {
  const db = await openOfflineVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('device_meta', 'readonly');
    const req = tx.objectStore('device_meta').get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror = () => reject(req.error);
  });
}

async function setMeta<T = any>(key: string, value: T): Promise<void> {
  const db = await openOfflineVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('device_meta', 'readwrite');
    tx.objectStore('device_meta').put({ key, value, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Identifiant matériel persistant unique de ce poste/tablette */
export async function getOrCreateOfflineDeviceId(): Promise<string> {
  const existing = await getMeta<string>('device_id');
  if (existing) return existing;
  const randomTag = crypto
    .getRandomValues(new Uint8Array(3))
    .reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '')
    .toUpperCase();
  const created = `POSTE-${randomTag}`;
  await setMeta('device_id', created);
  return created;
}

/**
 * Dérive une clé AES-256-GCM non-extractible en RAM pour chiffrer IndexedDB.
 * Utilise soit un PIN défini par l'utilisateur, soit l'empreinte de session locale.
 */
async function deriveAesKey(secretSeed: string, userId: string, schoolId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${secretSeed}::${userId}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Sel déterministe lié à l'utilisateur, à l'école et à l'appareil
  const deviceId = await getOrCreateOfflineDeviceId();
  const salt = enc.encode(`edunova-aes256-v1:${schoolId}:${userId}:${deviceId}`);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Non-extractible depuis JavaScript / DevTools
    ['encrypt', 'decrypt']
  );
}

/** Déverrouille automatiquement le coffre local au chargement de la session authentifiée */
export async function ensureOfflineVaultUnlocked(userId: string, schoolId: string): Promise<boolean> {
  if (!userId || typeof crypto === 'undefined' || !crypto.subtle) return false;
  const effectiveSchool = schoolId || 'global';
  const identityKey = `${userId}:${effectiveSchool}`;

  // Si un PIN manuel verrouille le coffre sur ce poste partagé, ne pas auto-déverrouiller
  const customPinHash = await getMeta<string>(`${PIN_HASH_META_PREFIX}${userId}`).catch(() => null);
  if (customPinHash && activeVaultIdentity !== identityKey) {
    return false;
  }

  if (activeAesKey && activeVaultIdentity === identityKey) {
    return true;
  }

  let deviceSecret = await getMeta<string>(`device_secret_${userId}`).catch(() => null);
  if (!deviceSecret) {
    deviceSecret = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    await setMeta(`device_secret_${userId}`, deviceSecret).catch(() => {});
  }

  activeAesKey = await deriveAesKey(deviceSecret, userId, effectiveSchool);
  activeVaultIdentity = identityKey;
  return true;
}

export async function unlockOfflineVaultWithPin(
  pin: string,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const effectiveSchool = schoolId || 'global';
  const storedHash = await getMeta<string>(`${PIN_HASH_META_PREFIX}${userId}`);
  const candidateHash = await sha256Hex(`${pin}::${userId}::edunova-pin`);
  if (storedHash && storedHash !== candidateHash) {
    return false;
  }
  activeAesKey = await deriveAesKey(pin, userId, effectiveSchool);
  activeVaultIdentity = `${userId}:${effectiveSchool}`;
  return true;
}

export async function setOfflineVaultPin(pin: string, userId: string, schoolId: string): Promise<void> {
  const clean = pin.trim();
  if (clean.length < 4 || clean.length > 12) {
    throw new Error('Le code PIN doit contenir entre 4 et 12 caractères.');
  }
  const pinHash = await sha256Hex(`${clean}::${userId}::edunova-pin`);
  await setMeta(`${PIN_HASH_META_PREFIX}${userId}`, pinHash);
  activeAesKey = await deriveAesKey(clean, userId, schoolId || 'global');
  activeVaultIdentity = `${userId}:${schoolId || 'global'}`;
}

export async function hasOfflineVaultPin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const h = await getMeta<string>(`${PIN_HASH_META_PREFIX}${userId}`).catch(() => null);
  return Boolean(h);
}

export function isOfflineVaultUnlocked(): boolean {
  return activeAesKey !== null;
}

export function lockOfflineVault(): void {
  activeAesKey = null;
  activeVaultIdentity = null;
}

export async function encryptPayloadWithActiveKey<T>(
  data: T,
  aadContext: string,
  userId?: string,
  schoolId?: string
): Promise<{ iv: string; cipher: string }> {
  if (!activeAesKey && userId) {
    await ensureOfflineVaultUnlocked(userId, schoolId || 'global');
  }
  if (!activeAesKey) {
    throw new Error('COFFRE_VERROUILLE: Veuillez déverrouiller votre code PIN hors-ligne.');
  }

  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource, additionalData: enc.encode(aadContext) },
    activeAesKey,
    plaintext
  );

  return {
    iv: toBase64(ivBytes),
    cipher: toBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function decryptPayloadWithActiveKey<T>(
  payload: { iv: string; cipher: string },
  aadContext: string,
  userId?: string,
  schoolId?: string
): Promise<T> {
  if (!activeAesKey && userId) {
    await ensureOfflineVaultUnlocked(userId, schoolId || 'global');
  }
  if (!activeAesKey) {
    throw new Error('COFFRE_VERROUILLE: Déverrouillez votre session locale pour lire ces données.');
  }

  const ivBytes = fromBase64(payload.iv);
  const cipherBytes = fromBase64(payload.cipher);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as unknown as BufferSource,
      additionalData: new TextEncoder().encode(aadContext),
    },
    activeAesKey,
    cipherBytes as unknown as BufferSource
  );

  return JSON.parse(new TextDecoder().decode(decryptedBuffer)) as T;
}

export function validateReceiptBeforeLocalSave(
  r: Pick<OfflineReceiptRecord, 'schoolId' | 'studentId' | 'cashierId' | 'amount' | 'currency' | 'localSequence'>
): void {
  if (!r.schoolId || !r.studentId || !r.cashierId) {
    throw new Error('Reçu invalide : établissement, élève ou caissier manquant.');
  }
  if (!Number.isFinite(r.amount) || r.amount <= 0 || r.amount > 5_000_000) {
    throw new Error('Montant hors bornes autorisées (0 - 5 000 000).');
  }
  if (r.currency !== 'HTG' && r.currency !== 'USD') {
    throw new Error('Devise non supportée.');
  }
  if (!Number.isInteger(r.localSequence) || r.localSequence <= 0) {
    throw new Error('Séquence locale invalide.');
  }
}

export function validateGradeBeforeLocalSave(g: Pick<OfflineGradeRecord, 'score' | 'maxScore'>): void {
  if (!Number.isFinite(g.score) || !Number.isFinite(g.maxScore) || g.maxScore <= 0) {
    throw new Error('Barème ou score invalide.');
  }
  if (g.score < 0 || g.score > g.maxScore) {
    throw new Error(`La note (${g.score}) doit être comprise entre 0 et ${g.maxScore}.`);
  }
}

/** Empreinte SHA-256 chaînée (journal append-only contre altération ou suppression locale) */
export async function computeReceiptSealHash(
  prevHash: string,
  data: {
    clientTxId: string;
    studentId: string;
    amount: number;
    currency: string;
    localSequence: number;
    createdAtIso: string;
    cashierId: string;
  }
): Promise<string> {
  const canonical = [
    prevHash,
    data.clientTxId,
    data.studentId,
    data.amount.toFixed(2),
    data.currency,
    String(data.localSequence),
    data.createdAtIso,
    data.cashierId,
  ].join('|');
  return sha256Hex(canonical);
}

/** Alloue de manière atomique le prochain numéro provisoire et chaîne le hash */
export async function allocateProvisionalReceiptSeal(input: {
  schoolId: string;
  studentId: string;
  amount: number;
  currency: 'HTG' | 'USD';
  cashierId: string;
}): Promise<{
  clientTxId: string;
  deviceId: string;
  localSequence: number;
  provisionalNumber: string;
  prevReceiptHash: string;
  recordHash: string;
  createdAtIso: string;
}> {
  const deviceId = await getOrCreateOfflineDeviceId();
  const seqKey = `receipt_seq_${input.schoolId}`;
  const hashKey = `receipt_last_hash_${input.schoolId}`;

  const currentSeq = (await getMeta<number>(seqKey)) || 0;
  const nextSeq = currentSeq + 1;
  const prevHash = (await getMeta<string>(hashKey)) || 'GENESIS_EDUNOVA_LEDGER_V1';

  const clientTxId = generateUuidV4();
  const createdAtIso = new Date().toISOString();
  const datePart = createdAtIso.slice(0, 10).replace(/-/g, '');
  const seqPart = String(nextSeq).padStart(5, '0');
  const provisionalNumber = `PROV-${deviceId}-${datePart}-${seqPart}`;

  const recordHash = await computeReceiptSealHash(prevHash, {
    clientTxId,
    studentId: input.studentId,
    amount: input.amount,
    currency: input.currency,
    localSequence: nextSeq,
    createdAtIso,
    cashierId: input.cashierId,
  });

  await setMeta(seqKey, nextSeq);
  await setMeta(hashKey, recordHash);

  return {
    clientTxId,
    deviceId,
    localSequence: nextSeq,
    provisionalNumber,
    prevReceiptHash: prevHash,
    recordHash,
    createdAtIso,
  };
}

/** Vérifie la persistance stockage Chrome/Android et le quota disponible */
export async function ensureStorageQuotaHealth(): Promise<StorageQuotaHealth> {
  let persisted = false;
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
      if (!persisted && navigator.storage.persist) {
        persisted = await navigator.storage.persist();
      }
    }
  } catch {
    persisted = false;
  }

  try {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : { usage: 0, quota: 0 };
    const usedMb = Number(((est.usage ?? 0) / (1024 * 1024)).toFixed(2));
    const quotaMb = Number(((est.quota ?? 0) / (1024 * 1024)).toFixed(2));
    const usageRatio = est.quota ? (est.usage ?? 0) / est.quota : 0;
    return { persisted, usedMb, quotaMb, usageRatio };
  } catch {
    return { persisted, usedMb: 0, quotaMb: 0, usageRatio: 0 };
  }
}

/** Chiffre un paquet de portage d'urgence (.edunova-sync) avec mot de passe temporaire pour transfert USB/WhatsApp */
export async function sealPortableBundle(payloadJson: string, transferPassphrase: string): Promise<string> {
  if (!transferPassphrase || transferPassphrase.trim().length < 6) {
    throw new Error('Utilisez une phrase secrète d’au moins 6 caractères pour protéger le fichier exporté.');
  }
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await crypto.subtle.importKey('raw', enc.encode(transferPassphrase.trim()), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(payloadJson)
  );

  return JSON.stringify({
    format: 'EDUNOVA_OFFLINE_SYNC_PACK',
    version: 1,
    exportedAt: new Date().toISOString(),
    salt: toBase64(salt),
    iv: toBase64(iv),
    cipher: toBase64(new Uint8Array(encrypted)),
  });
}

export async function unsealPortableBundle(bundleText: string, transferPassphrase: string): Promise<string> {
  const parsed = JSON.parse(bundleText);
  if (parsed?.format !== 'EDUNOVA_OFFLINE_SYNC_PACK' || !parsed?.salt || !parsed?.iv || !parsed?.cipher) {
    throw new Error('Fichier .edunova-sync invalide.');
  }
  const enc = new TextEncoder();
  const salt = fromBase64(parsed.salt);
  const iv = fromBase64(parsed.iv);
  const cipher = fromBase64(parsed.cipher);

  const baseKey = await crypto.subtle.importKey('raw', enc.encode(transferPassphrase.trim()), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipher as unknown as BufferSource
  );
  return new TextDecoder().decode(decrypted);
}

export interface RefCacheEnvelope {
  cacheKey: string;
  schoolId: string;
  iv: string;
  cipher: string;
  updatedAtMs: number;
}

/** Chiffre et stocke un jeu de données de référence (élèves, classes, barèmes, notes) dans IndexedDB ref_cache */
export async function saveEncryptedRefCache<T>(
  cacheKey: string,
  data: T,
  userId: string,
  schoolId: string
): Promise<void> {
  if (!userId || !schoolId) return;
  try {
    const unlocked = await ensureOfflineVaultUnlocked(userId, schoolId);
    if (!unlocked) return;
    const updatedAtMs = Date.now();
    const { iv, cipher } = await encryptPayloadWithActiveKey(
      { data, updatedAtMs },
      `REF_CACHE:${schoolId}:${cacheKey}`,
      userId,
      schoolId
    );
    const db = await openOfflineVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('ref_cache', 'readwrite');
      tx.objectStore('ref_cache').put({
        cacheKey,
        schoolId,
        iv,
        cipher,
        updatedAtMs,
      } satisfies RefCacheEnvelope);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[OfflineRefCache] Écriture cache ignorée:', err);
  }
}

/** Déchiffre et lit un jeu de données de référence depuis IndexedDB ref_cache */
export async function loadEncryptedRefCache<T>(
  cacheKey: string,
  userId: string,
  schoolId: string
): Promise<{ data: T; updatedAtMs: number } | null> {
  if (!userId || !schoolId) return null;
  try {
    const db = await openOfflineVaultDb();
    const row = await new Promise<RefCacheEnvelope | undefined>((resolve, reject) => {
      const tx = db.transaction('ref_cache', 'readonly');
      const req = tx.objectStore('ref_cache').get(cacheKey);
      req.onsuccess = () => resolve(req.result as RefCacheEnvelope | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!row || !row.iv || !row.cipher) return null;

    const unlocked = await ensureOfflineVaultUnlocked(userId, schoolId);
    if (!unlocked) return null;

    const decrypted = await decryptPayloadWithActiveKey<{ data: T; updatedAtMs: number }>(
      { iv: row.iv, cipher: row.cipher },
      `REF_CACHE:${schoolId}:${cacheKey}`,
      userId,
      schoolId
    );
    return decrypted;
  } catch {
    return null;
  }
}

/** Retourne le nombre de tables en cache hors-ligne et l'horodatage de la dernière mise en cache */
export async function getRefCacheStatus(
  schoolId: string
): Promise<{ datasets: number; lastUpdatedAtMs: number | null }> {
  try {
    const db = await openOfflineVaultDb();
    const all = await new Promise<RefCacheEnvelope[]>((resolve, reject) => {
      const tx = db.transaction('ref_cache', 'readonly');
      const req = tx.objectStore('ref_cache').getAll();
      req.onsuccess = () => resolve((req.result as RefCacheEnvelope[]) || []);
      req.onerror = () => reject(req.error);
    });
    const scoped = all.filter((r) => r.schoolId === schoolId);
    let lastUpdatedAtMs: number | null = null;
    for (const r of scoped) {
      if (!lastUpdatedAtMs || r.updatedAtMs > lastUpdatedAtMs) {
        lastUpdatedAtMs = r.updatedAtMs;
      }
    }
    return { datasets: scoped.length, lastUpdatedAtMs };
  } catch {
    return { datasets: 0, lastUpdatedAtMs: null };
  }
}

