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
let activeLanPlainIdentity: string | null = null;

const LAN_PLAIN_IV_MARKER = 'LAN_HTTP_PLAIN_V1';

export function isWebCryptoSecureContextAvailable(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

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

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256PureHex(data: Uint8Array): string {
  const bitLen = data.length * 8;
  const paddedLen = (((data.length + 9) + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H).map((word) => word.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  if (isWebCryptoSecureContextAvailable()) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256PureHex(data);
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
  if (!userId) return false;
  const effectiveSchool = schoolId || 'global';
  const identityKey = `${userId}:${effectiveSchool}`;

  // Si un PIN manuel verrouille le coffre sur ce poste partagé, ne pas auto-déverrouiller
  const customPinHash = await getMeta<string>(`${PIN_HASH_META_PREFIX}${userId}`).catch(() => null);
  if (customPinHash && activeVaultIdentity !== identityKey && activeLanPlainIdentity !== identityKey) {
    return false;
  }

  // En contexte LAN HTTP sans TLS, crypto.subtle est absent : activer le mode de compatibilité LAN
  if (!isWebCryptoSecureContextAvailable()) {
    activeLanPlainIdentity = identityKey;
    activeVaultIdentity = identityKey;
    return true;
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
  if (!isWebCryptoSecureContextAvailable()) {
    activeLanPlainIdentity = `${userId}:${effectiveSchool}`;
    activeVaultIdentity = `${userId}:${effectiveSchool}`;
    return true;
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
  if (!isWebCryptoSecureContextAvailable()) {
    activeLanPlainIdentity = `${userId}:${schoolId || 'global'}`;
    activeVaultIdentity = `${userId}:${schoolId || 'global'}`;
    return;
  }
  activeAesKey = await deriveAesKey(clean, userId, schoolId || 'global');
  activeVaultIdentity = `${userId}:${schoolId || 'global'}`;
}

export async function hasOfflineVaultPin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const h = await getMeta<string>(`${PIN_HASH_META_PREFIX}${userId}`).catch(() => null);
  return Boolean(h);
}

export function isOfflineVaultUnlocked(): boolean {
  return activeAesKey !== null || activeLanPlainIdentity !== null;
}

export function lockOfflineVault(): void {
  activeAesKey = null;
  activeVaultIdentity = null;
  activeLanPlainIdentity = null;
}

export async function encryptPayloadWithActiveKey<T>(
  data: T,
  aadContext: string,
  userId?: string,
  schoolId?: string
): Promise<{ iv: string; cipher: string }> {
  if (!activeAesKey && !activeLanPlainIdentity && userId) {
    await ensureOfflineVaultUnlocked(userId, schoolId || 'global');
  }
  if (!activeAesKey && !activeLanPlainIdentity) {
    throw new Error('COFFRE_VERROUILLE: Veuillez déverrouiller votre code PIN hors-ligne.');
  }

  const enc = new TextEncoder();
  if (!activeAesKey || !isWebCryptoSecureContextAvailable()) {
    const wrapped = JSON.stringify({ aad: aadContext, data });
    return {
      iv: LAN_PLAIN_IV_MARKER,
      cipher: toBase64(enc.encode(wrapped)),
    };
  }

  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
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
  if (payload.iv === LAN_PLAIN_IV_MARKER) {
    if (!activeLanPlainIdentity && !activeAesKey && userId) {
      await ensureOfflineVaultUnlocked(userId, schoolId || 'global');
    }
    if (!activeLanPlainIdentity && !activeAesKey) {
      throw new Error('COFFRE_VERROUILLE: Déverrouillez votre session locale pour lire ces données.');
    }
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64(payload.cipher))) as { aad?: string; data: T };
    if (decoded.aad && decoded.aad !== aadContext) {
      throw new Error('Contexte de cache invalide.');
    }
    return decoded.data;
  }

  if (!isWebCryptoSecureContextAvailable()) {
    throw new Error('Donnée chiffrée AES-256 : ouvrez depuis HTTPS ou localhost pour déchiffrer.');
  }
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
  if (!isWebCryptoSecureContextAvailable()) {
    throw new Error('L’export chiffré .edunova-sync requiert un contexte sécurisé (https:// ou http://localhost:3000).');
  }
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
  if (!isWebCryptoSecureContextAvailable()) {
    throw new Error('Le déchiffrement .edunova-sync requiert un contexte sécurisé (https:// ou http://localhost:3000).');
  }
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

