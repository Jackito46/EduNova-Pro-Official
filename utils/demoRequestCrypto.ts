/**
 * Utilitaires cryptographiques partagés (Client Navigateur & Backend Node)
 * pour la signature HMAC dynamique des demandes de démo EduNova.
 *
 * Modèle de sécurité :
 * - Le secret maître `DEMO_REQUEST_SECRET` reste STRICTEMENT côté serveur.
 * - Le client obtient d'abord un challenge éphémère à usage unique
 *   (`timestamp`, `nonce`, `ephemeralKey`) dérivé par HMAC-SHA256 sur le serveur.
 * - Le client calcule dynamiquement via Web Crypto API (`crypto.subtle`)
 *   la signature HMAC-SHA256 du payload canonique avant le POST `/api/demo-request`.
 */

export interface DemoChallengeResponse {
  success: boolean;
  timestamp: string;
  nonce: string;
  ephemeralKey: string;
  expiresAt: number;
}

export interface DemoSignatureHeaders {
  signature: string;
  timestamp: string;
  nonce: string;
}

/**
 * Construit une chaîne canonique déterministe partagée à l'identique
 * entre le navigateur et le middleware Express de vérification HMAC.
 */
export function buildDemoCanonicalPayload(params: {
  timestamp: string;
  nonce?: string;
  schoolName: string;
  phone: string;
  email?: string;
}): string {
  const ts = String(params.timestamp || '').trim();
  const nonce = String(params.nonce || '').trim();
  const school = String(params.schoolName || '').trim();
  const phone = String(params.phone || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  return `${ts}:${nonce}:${school}:${phone}:${email}`;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Génère dynamiquement côté client un jeton HMAC-SHA256 lié au payload
 * et à un challenge éphémère anti-rejeu délivré par `/api/demo-request/challenge`.
 */
export async function signDemoRequestOnClient(params: {
  schoolName: string;
  phone: string;
  email?: string;
}): Promise<DemoSignatureHeaders> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API indisponible dans ce navigateur pour sécuriser l’envoi.');
  }

  const challengeRes = await fetch('/api/demo-request/challenge', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  const challengeData = (await challengeRes.json().catch(() => null)) as DemoChallengeResponse | null;
  if (!challengeRes.ok || !challengeData?.success || !challengeData.ephemeralKey || !challengeData.nonce || !challengeData.timestamp) {
    throw new Error('Impossible d’initialiser le jeton de sécurité de la requête.');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(challengeData.ephemeralKey);
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const canonicalPayload = buildDemoCanonicalPayload({
    timestamp: challengeData.timestamp,
    nonce: challengeData.nonce,
    schoolName: params.schoolName,
    phone: params.phone,
    email: params.email
  });

  const signatureBuffer = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(canonicalPayload)
  );

  return {
    signature: bytesToHex(signatureBuffer),
    timestamp: challengeData.timestamp,
    nonce: challengeData.nonce
  };
}
