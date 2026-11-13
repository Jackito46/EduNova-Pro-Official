import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { cleanText } from './demoContactService.ts';
import { buildDemoCanonicalPayload } from '../utils/demoRequestCrypto.ts';
import {
  validateDemoContactName,
  validateDemoEmail,
  validateDemoNotes,
  validateDemoPhone,
  validateDemoSchoolName
} from '../utils/validation.ts';

export interface ValidatedDemoRequestPayload {
  schoolName: string;
  contactName: string;
  phone: string;
  email: string;
  city?: string;
  schoolType?: string;
  studentBracket?: string;
  preferredChannel: 'both' | 'whatsapp' | 'email';
  notes: string;
}

export interface DemoProtectedRequest extends Request {
  validatedDemoRequest?: ValidatedDemoRequestPayload;
  demoAuthMeta?: {
    timestamp: string;
    nonce: string;
    mode: 'ephemeral-challenge' | 'direct-hmac';
  };
}

const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FUTURE_SKEW_MS = 60 * 1000; // 60 secondes de dérive d'horloge tolérée
const HEX_SHA256_REGEX = /^[a-f0-9]{64}$/;

// Registre mémoire des nonces déjà consommés (protection anti-rejeu)
const consumedNonces = new Map<string, number>();

// Secret éphémère de repli généré uniquement au démarrage si aucune variable d'env n'est définie
let ephemeralBootFallbackSecret: string | null = null;
let warnedMissingSecret = false;

const nonceCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces.entries()) {
    if (now > expiresAt) {
      consumedNonces.delete(nonce);
    }
  }
}, 5 * 60 * 1000);
if (typeof nonceCleanupTimer.unref === 'function') {
  nonceCleanupTimer.unref();
}

/**
 * Résout le secret HMAC exclusivement côté serveur à partir de `DEMO_REQUEST_SECRET`.
 * Repli sécurisé dérivé uniquement de clés serveur existantes si non encore configuré.
 */
export function resolveDemoRequestSecret(): string {
  const explicitSecret = (process.env.DEMO_REQUEST_SECRET || '').trim();
  if (explicitSecret.length >= 16) {
    return explicitSecret;
  }

  const serverEntropy = (
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ''
  ).trim();

  if (serverEntropy) {
    return crypto
      .createHmac('sha256', serverEntropy)
      .update('edunova-demo-request-secret-derivation-v1')
      .digest('hex');
  }

  if (!ephemeralBootFallbackSecret) {
    ephemeralBootFallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      '[DemoSecurity] DEMO_REQUEST_SECRET non défini : utilisation d’une clé serveur éphémère en mémoire. Définissez DEMO_REQUEST_SECRET dans .env en production.'
    );
  }
  return ephemeralBootFallbackSecret;
}

function deriveEphemeralChallengeKey(secret: string, timestamp: string, nonce: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`edunova-demo-key:v1:${timestamp}:${nonce}`)
    .digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!HEX_SHA256_REGEX.test(a) || !HEX_SHA256_REGEX.test(b)) {
    return false;
  }
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Émet un challenge à usage unique et durée de vie limitée pour permettre au navigateur
 * de signer dynamiquement la requête sans jamais exposer `DEMO_REQUEST_SECRET`.
 */
export function issueDemoRequestChallenge() {
  const secret = resolveDemoRequestSecret();
  const now = Date.now();
  const timestamp = String(now);
  const nonce = crypto.randomBytes(16).toString('hex');
  const ephemeralKey = deriveEphemeralChallengeKey(secret, timestamp, nonce);

  return {
    success: true,
    timestamp,
    nonce,
    ephemeralKey,
    expiresAt: now + CHALLENGE_TTL_MS
  };
}

/**
 * Middleware Express 1 : Vérification cryptographique HMAC-SHA256 + anti-rejeu.
 */
export function verifyDemoRequestHmac(
  req: DemoProtectedRequest,
  res: Response,
  next: NextFunction
) {
  const body = (req.body || {}) as Record<string, any>;

  // Honeypot anti-bot silencieux : ne consomme pas de nonce et n'atteint pas la base
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return res.json({
      success: true,
      referenceCode: 'DEMO-FILTERED',
      delivery: { savedToInbox: false, emailSent: false, whatsappAutoSent: false }
    });
  }

  const rawSignature = String(
    req.get('X-Demo-Signature') || req.get('X-Signature') || ''
  )
    .trim()
    .toLowerCase();
  const rawTimestamp = String(
    req.get('X-Demo-Timestamp') || req.get('X-Timestamp') || ''
  ).trim();
  const rawNonce = String(
    req.get('X-Demo-Nonce') || req.get('X-Nonce') || ''
  ).trim();

  if (!rawSignature || !rawTimestamp) {
    return res.status(401).json({
      success: false,
      code: 'DEMO_HMAC_MISSING',
      error: 'Signature de sécurité manquante. Veuillez recharger la page et réessayer.'
    });
  }

  if (!HEX_SHA256_REGEX.test(rawSignature)) {
    return res.status(403).json({
      success: false,
      code: 'DEMO_HMAC_MALFORMED',
      error: 'Format de signature cryptographique invalide.'
    });
  }

  const parsedTs = Number(rawTimestamp);
  const now = Date.now();
  if (!Number.isFinite(parsedTs) || parsedTs <= 0) {
    return res.status(401).json({
      success: false,
      code: 'DEMO_TIMESTAMP_INVALID',
      error: 'Horodatage de requête invalide.'
    });
  }

  if (now - parsedTs > CHALLENGE_TTL_MS || parsedTs - now > MAX_FUTURE_SKEW_MS) {
    return res.status(401).json({
      success: false,
      code: 'DEMO_TIMESTAMP_EXPIRED',
      error: 'Votre session de formulaire a expiré. Veuillez soumettre à nouveau.'
    });
  }

  const schoolName = cleanText(body.schoolName ?? body.school ?? body.ecole, 160);
  const phone = cleanText(body.phone ?? body.telephone ?? body.tel, 50);
  const email = cleanText(body.email, 160);

  const secret = resolveDemoRequestSecret();
  const canonicalPayload = buildDemoCanonicalPayload({
    timestamp: rawTimestamp,
    nonce: rawNonce,
    schoolName,
    phone,
    email
  });

  if (rawNonce) {
    if (!/^[a-f0-9]{16,64}$/i.test(rawNonce)) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_NONCE_INVALID',
        error: 'Jeton anti-rejeu invalide.'
      });
    }

    if (consumedNonces.has(rawNonce)) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_NONCE_REPLAYED',
        error: 'Ce jeton de sécurité a déjà été utilisé. Veuillez réessayer.'
      });
    }

    const ephemeralKey = deriveEphemeralChallengeKey(secret, rawTimestamp, rawNonce);
    const expectedSig = crypto
      .createHmac('sha256', ephemeralKey)
      .update(canonicalPayload)
      .digest('hex');

    if (!timingSafeEqualHex(rawSignature, expectedSig)) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_HMAC_INVALID',
        error: 'Échec de vérification de la signature de sécurité.'
      });
    }

    // Marque le nonce comme consommé immédiatement après vérification valide
    consumedNonces.set(rawNonce, parsedTs + CHALLENGE_TTL_MS);
    req.demoAuthMeta = {
      timestamp: rawTimestamp,
      nonce: rawNonce,
      mode: 'ephemeral-challenge'
    };
    return next();
  }

  // Mode direct serveur-à-serveur : signature calculée directement avec DEMO_REQUEST_SECRET
  const directExpectedSig = crypto
    .createHmac('sha256', secret)
    .update(canonicalPayload)
    .digest('hex');

  if (!timingSafeEqualHex(rawSignature, directExpectedSig)) {
    return res.status(403).json({
      success: false,
      code: 'DEMO_HMAC_INVALID',
      error: 'Signature HMAC invalide pour l’accès direct.'
    });
  }

  req.demoAuthMeta = {
    timestamp: rawTimestamp,
    nonce: '',
    mode: 'direct-hmac'
  };
  return next();
}

/**
 * Middleware Express 2 : Validation stricte de la structure et du format
 * des données métier (établissement, téléphone, email, contact, notes) avant Supabase.
 */
export function validateDemoRequestPayload(
  req: DemoProtectedRequest,
  res: Response,
  next: NextFunction
) {
  const body = (req.body || {}) as Record<string, any>;

  const schoolName = cleanText(body.schoolName ?? body.school ?? body.ecole, 160);
  const contactName = cleanText(body.contactName ?? body.name ?? body.nom, 120);
  const phone = cleanText(body.phone ?? body.telephone ?? body.tel, 50);
  const email = cleanText(body.email, 160);
  const notes = cleanText(body.notes ?? body.message, 800);
  const city = cleanText(body.city, 100);
  const schoolType = cleanText(body.schoolType, 100);
  const studentBracket = cleanText(body.studentBracket, 60);

  const preferredChannel: 'both' | 'whatsapp' | 'email' =
    body.preferredChannel === 'whatsapp' || body.preferredChannel === 'email'
      ? body.preferredChannel
      : 'both';

  const fieldErrors: Record<string, string> = {};

  const schoolErr = validateDemoSchoolName(schoolName);
  if (schoolErr) fieldErrors.schoolName = schoolErr;

  const contactErr = validateDemoContactName(contactName);
  if (contactErr) fieldErrors.contactName = contactErr;

  const phoneErr = validateDemoPhone(phone);
  if (phoneErr) fieldErrors.phone = phoneErr;

  const emailErr = validateDemoEmail(email, preferredChannel === 'email');
  if (emailErr) fieldErrors.email = emailErr;

  const notesErr = validateDemoNotes(notes);
  if (notesErr) fieldErrors.notes = notesErr;

  if (Object.keys(fieldErrors).length > 0) {
    const firstError =
      fieldErrors.schoolName ||
      fieldErrors.contactName ||
      fieldErrors.phone ||
      fieldErrors.email ||
      fieldErrors.notes ||
      'Les données fournies sont invalides.';

    return res.status(400).json({
      success: false,
      code: 'DEMO_VALIDATION_FAILED',
      error: firstError,
      fieldErrors
    });
  }

  req.validatedDemoRequest = {
    schoolName,
    contactName,
    phone,
    email,
    city: city || undefined,
    schoolType: schoolType || undefined,
    studentBracket: studentBracket || undefined,
    preferredChannel,
    notes
  };

  return next();
}

export const demoRequestSecurityMiddleware = [
  verifyDemoRequestHmac,
  validateDemoRequestPayload
];
